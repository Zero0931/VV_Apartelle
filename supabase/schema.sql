-- VV Apartelle Panabo — draft PostgreSQL schema for Supabase
-- NOT used by the demo (which stores data in the browser). This is the target
-- schema for the production version; it mirrors src/lib/types.ts.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------- profiles
-- One row per auth.users row. Role drives permissions (RLS below).
create type user_role as enum ('customer', 'admin', 'owner');

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null unique,
  phone       text not null,
  role        user_role not null default 'customer',
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now()
);

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------- rooms & rates
create table rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tagline      text not null default '',
  description  text not null default '',
  capacity     int  not null check (capacity > 0),
  bed_type     text not null default '',
  amenities    text[] not null default '{}',
  base_rate    numeric(10,2) not null check (base_rate > 0),
  photo_path   text,                       -- Supabase Storage object path
  active       boolean not null default true,
  archived_at  timestamptz,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create table rate_overrides (
  room_id  uuid not null references rooms (id) on delete cascade,
  night    date not null,
  rate     numeric(10,2) not null check (rate > 0),
  primary key (room_id, night)
);

-- ---------------------------------------------------------------- bookings
create type booking_status as enum (
  'hold', 'pending_verification', 'confirmed', 'checked_in',
  'completed', 'expired', 'rejected', 'cancelled'
);
create type payment_method as enum ('gcash', 'maya', 'bank');

create table bookings (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,            -- e.g. VV-7KQ2MD
  user_id          uuid not null references profiles (id),
  guest_name       text not null,
  guest_email      text not null,
  guest_phone      text not null,
  total            numeric(10,2) not null,
  status           booking_status not null default 'hold',
  hold_expires_at  timestamptz,
  payment_method   payment_method,
  payment_ref      text,
  payment_proof    text,                            -- Storage path of screenshot
  payment_submitted_at timestamptz,
  verified_by      uuid references profiles (id),
  verified_at      timestamptz,
  reject_reason    text,
  checked_in_at    timestamptz,
  checked_out_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One row per room per night. Price is frozen at reservation time.
create table booking_nights (
  booking_id  uuid not null references bookings (id) on delete cascade,
  room_id     uuid not null references rooms (id),
  night       date not null,
  rate        numeric(10,2) not null,
  -- denormalised so the unique index below can see it
  active      boolean not null default true,
  primary key (booking_id, room_id, night)
);

-- THE double-booking guard: a room-night can belong to only one active booking.
-- `active` is flipped to false when a booking expires / is rejected / cancelled.
create unique index booking_nights_no_double_booking
  on booking_nights (room_id, night) where active;

create table booking_events (
  id          bigserial primary key,
  booking_id  uuid not null references bookings (id) on delete cascade,
  status      booking_status not null,
  actor       uuid references profiles (id),
  note        text,
  at          timestamptz not null default now()
);

-- Reserve nights atomically. Raises unique_violation (23505) if any night was
-- taken a moment ago, which the app reports as "someone just booked this".
create or replace function create_hold(p_nights jsonb, p_hold_minutes int default 15)
returns bookings language plpgsql security definer set search_path = public as $$
declare
  b bookings;
  me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if me is null then raise exception 'not signed in'; end if;

  -- release this guest's previous hold
  update bookings set status = 'expired', updated_at = now()
   where user_id = me.id and status = 'hold';
  update booking_nights bn set active = false
    from bookings bk where bk.id = bn.booking_id and bk.user_id = me.id and bk.status = 'expired';

  insert into bookings (code, user_id, guest_name, guest_email, guest_phone, total, hold_expires_at)
  values ('VV-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)), me.id, me.name, me.email, me.phone, 0,
          now() + make_interval(mins => p_hold_minutes))
  returning * into b;

  insert into booking_nights (booking_id, room_id, night, rate)
  select b.id, r.id, (n->>'date')::date, coalesce(o.rate, r.base_rate)
    from jsonb_array_elements(p_nights) n
    join rooms r on r.id = (n->>'roomId')::uuid and r.active and r.archived_at is null
    left join rate_overrides o on o.room_id = r.id and o.night = (n->>'date')::date;

  update bookings set total = (select sum(rate) from booking_nights where booking_id = b.id)
   where id = b.id returning * into b;
  insert into booking_events (booking_id, status, actor) values (b.id, 'hold', me.id);
  return b;
end $$;

-- Expire stale holds (schedule with pg_cron every minute).
create or replace function expire_holds() returns void language sql as $$
  with x as (
    update bookings set status = 'expired', hold_expires_at = null, updated_at = now()
     where status = 'hold' and hold_expires_at < now() returning id
  )
  update booking_nights set active = false where booking_id in (select id from x);
$$;
-- select cron.schedule('expire-holds', '* * * * *', 'select expire_holds()');

-- ---------------------------------------------------------------- payments, email, settings
create table payment_channels (
  id              payment_method primary key,
  label           text not null,
  account_name    text not null,
  account_number  text not null,
  bank_name       text,
  qr_path         text,           -- Storage path
  instructions    text,
  enabled         boolean not null default true
);

create table email_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles (id),
  to_email    text not null,
  kind        text not null,      -- welcome | received | confirmed | rejected | cancelled
  booking_id  uuid references bookings (id),
  provider_id text,               -- e.g. Resend message id
  sent_at     timestamptz not null default now()
);

create table settings (
  id                  boolean primary key default true check (id), -- single row
  property_name       text not null,
  address             text not null,
  contact_phone       text not null,
  contact_email       text not null,
  hold_minutes        int  not null default 15,
  check_in_time       time not null default '14:00',
  check_out_time      time not null default '12:00',
  booking_window_days int  not null default 90
);

-- ---------------------------------------------------------------- row level security
alter table profiles         enable row level security;
alter table rooms            enable row level security;
alter table rate_overrides   enable row level security;
alter table bookings         enable row level security;
alter table booking_nights   enable row level security;
alter table booking_events   enable row level security;
alter table payment_channels enable row level security;
alter table email_log        enable row level security;
alter table settings         enable row level security;

-- Public read of catalogue data
create policy "rooms readable"    on rooms            for select using (true);
create policy "rates readable"    on rate_overrides   for select using (true);
create policy "channels readable" on payment_channels for select using (enabled or auth_role() = 'owner');
create policy "settings readable" on settings         for select using (true);
-- Availability: anyone may see which room-nights are taken (no guest details)
create policy "nights readable"   on booking_nights   for select using (true);

-- Owner-only management
create policy "owner rooms"    on rooms            for all using (auth_role() = 'owner') with check (auth_role() = 'owner');
create policy "owner rates"    on rate_overrides   for all using (auth_role() = 'owner') with check (auth_role() = 'owner');
create policy "owner channels" on payment_channels for all using (auth_role() = 'owner') with check (auth_role() = 'owner');
create policy "owner settings" on settings         for all using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- Profiles: self, or staff can see everyone; only owner manages admins
create policy "profile self or staff" on profiles for select
  using (id = auth.uid() or auth_role() in ('admin', 'owner'));
create policy "owner manages staff" on profiles for all
  using (auth_role() = 'owner') with check (auth_role() = 'owner');

-- Bookings: guests see their own; staff see and update all
create policy "own bookings"   on bookings for select using (user_id = auth.uid() or auth_role() in ('admin', 'owner'));
create policy "staff update"   on bookings for update using (auth_role() in ('admin', 'owner'));
create policy "guest submits payment" on bookings for update
  using (user_id = auth.uid() and status = 'hold')
  with check (user_id = auth.uid() and status in ('hold', 'pending_verification', 'cancelled'));
create policy "events visible" on booking_events for select
  using (auth_role() in ('admin', 'owner')
         or exists (select 1 from bookings b where b.id = booking_id and b.user_id = auth.uid()));
create policy "own emails" on email_log for select using (user_id = auth.uid() or auth_role() = 'owner');
