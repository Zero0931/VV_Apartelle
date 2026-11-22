# VV Apartelle Panabo — Online Booking & POS (Demo)

A clickable demo of an online booking / point-of-sale web app for **VV Apartelle Panabo**, a transient facility that rents rooms per night.

Built with **Next.js 16 (App Router) + React 19 + Tailwind CSS v4**. In this demo, all data is stored in the browser's `localStorage`. A Supabase (PostgreSQL) schema is drafted in [`supabase/schema.sql`](supabase/schema.sql) for the production version.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
# or a production build
npm run build && npm start
```

## Demo accounts

The login page has one-click buttons for each account.

| Role | Email | Password | Can do |
|---|---|---|---|
| Guest | `juan@guest.demo` | `guest123` | Book, pay, view receipts & inbox |
| Front desk admin | `frontdesk@vvapartelle.demo` | `admin123` | Verify payments, check guests in/out, cancel |
| Owner | `owner@vvapartelle.demo` | `owner123` | Everything above, plus dashboard, rooms, rates, payment QRs, staff, settings |

Each browser tab keeps its own login. You can open the **guest** in one tab and the **front desk** in another and watch bookings update live between them.

## The booking flow

1. **Check availability** (`/book`): a grid of rooms × nights. Tap any open nights, in any room, or use *Quick select* to pick a date range.
2. **Hold**: *Reserve & pay* locks the selected room-nights for the configured hold time (15 min by default) so nobody else can book them. If someone grabs a night first, the guest gets a clear error.
3. **Pay by QR** (`/checkout/[id]`): the guest scans the owner's GCash / Maya / bank QR, then submits the reference number and a payment screenshot. The booking becomes *Verifying payment*. If the timer runs out first, the nights are released.
4. **Verify**: a front desk admin or the owner checks the payment and clicks **Confirm** or **Reject** (with a reason).
5. **Receipt**: on confirmation, the guest gets an email with the receipt: booking code, QR code, nights and amount paid. In the demo, emails go to the **Demo Inbox** (`/inbox`). The receipt can be printed or saved as a PDF from *My bookings*.
6. **Front desk** (`/admin/check-in`): look up the booking code (it's also in the receipt QR), then check the guest in and out.

## Owner dashboard (`/admin`)

- Registered customers, payments waiting for verification, arrivals and in-house guests
- Gross revenue and occupancy for **this week / month / year**, compared with the same point in the previous period
- Revenue trend (30 days / 12 weeks / 12 months), occupancy per room, payment-channel mix
- **Rooms**: add, edit, close temporarily, or remove rooms. A room with booking history is archived so reports stay correct.
- **Rates**: base rate per room, plus special rates on chosen dates (holidays, weekends)
- **Payment QR**: upload the real GCash / Maya / bank QR codes and account details
- **Staff**: add or remove front desk admins
- **Settings**: hold time, check-in/out times, booking window, property info, **Reset demo data**

The seeded data contains about two years of realistic booking history, so the charts have something to show.

## Project structure

```
src/
  app/(site)/        guest pages: home, book, checkout, bookings, inbox, login, register
  app/admin/         admin pages: dashboard, bookings, check-in, rooms, rates, payments, customers, staff, settings
  components/        UI components (availability grid, receipt, charts, …)
  lib/types.ts       domain model
  lib/data/store.ts  DataStore interface: the only thing pages talk to
  lib/data/local-store.ts  localStorage implementation (demo)
  lib/data/seed.ts   demo data
  lib/analytics.ts   revenue / occupancy calculations
supabase/schema.sql  draft production schema with RLS and a DB-level double-booking guard
```

## Going live: next steps

1. **Supabase**: create the project, run `supabase/schema.sql`, then write `src/lib/data/supabase-store.ts` that implements the same `DataStore` interface. Swap it in at `getStore()` in `src/lib/data/provider.tsx`. No page needs to change.
   - The partial unique index on `booking_nights(room_id, night)` enforces "no double booking" in the database itself.
   - Schedule `expire_holds()` with `pg_cron`.
   - Store QR codes, room photos and payment screenshots in Supabase Storage, not as data URLs.
2. **Auth**: replace the demo login with Supabase Auth. Add route protection in `proxy.ts`; Next 16 renamed middleware to proxy.
3. **Email**: send the receipt with a provider such as Resend or Postmark from a server action or Supabase Edge Function when a booking is confirmed.
4. **Hosting**: deploy to Vercel or Cloudflare. Set the Supabase URL and keys as environment variables.

> ⚠️ Demo only: passwords are stored in plain text in the browser, and access control runs client-side. Don't enter real personal data or passwords.
