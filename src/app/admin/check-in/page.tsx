"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DoorOpen, LogOut, Search, Sunrise } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import { addDaysKey, firstNight, formatPeso, lastNight, stayLabel, todayKey } from "@/lib/format";
import type { Booking, Room } from "@/lib/types";
import { BookingActions } from "@/components/booking-actions";
import { StaySummary } from "@/components/stay-summary";
import { Button } from "@/components/ui/button";
import { Alert, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { FullPageLoader } from "@/components/ui/spinner";

export default function FrontDeskPage() {
  const store = useStore();
  const [code, setCode] = useState("");
  const [foundId, setFoundId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const today = todayKey();

  const { data } = useQuery(async (s) => {
    const [bookings, rooms] = await Promise.all([
      s.listBookings({ statuses: ["confirmed", "checked_in", "pending_verification"] }),
      s.listRooms({ includeArchived: true }),
    ]);
    return { bookings, rooms };
  });

  const lookup = async (e: FormEvent) => {
    e.preventDefault();
    const b = await store.findBookingByCode(code);
    setFoundId(b?.id ?? null);
    setNotFound(!b);
  };

  if (!data) return <FullPageLoader />;
  const { bookings, rooms } = data;
  const found = foundId ? bookings.find((b) => b.id === foundId) : null;
  const arrivals = bookings.filter((b) => b.status === "confirmed" && firstNight(b.nights) <= today && lastNight(b.nights) >= today);
  const inHouse = bookings.filter((b) => b.status === "checked_in");
  const departures = inHouse.filter((b) => lastNight(b.nights) < today);
  const tomorrow = bookings.filter((b) => b.status === "confirmed" && firstNight(b.nights) === addDaysKey(today, 1));

  return (
    <div>
      <PageHeader title="Front desk" description="Look up a guest's booking code to check them in." />

      <Card className="mb-6 p-5">
        <form onSubmit={lookup} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-subtle" />
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setNotFound(false);
              }}
              placeholder="Booking code, e.g. VV-7KQ2MD"
              className="h-12 pl-10 font-mono text-lg tracking-wider"
              autoFocus
            />
          </div>
          <Button type="submit" size="lg" disabled={!code.trim()}>
            Find booking
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted">
          Tip: the QR code on the guest&apos;s receipt contains the booking code — scan it with any QR scanner app.
        </p>
        {notFound && (
          <Alert tone="bad" className="mt-4">
            No booking found with code <b>{code}</b>.
          </Alert>
        )}
        {foundId && !found && (
          <Alert tone="warn" className="mt-4">
            This booking is no longer active. <Link href={`/admin/bookings/${foundId}`} className="underline">Open it</Link>
          </Alert>
        )}
        {found && <FoundBooking booking={found} rooms={rooms} />}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <ListCard title="Arriving today" icon={<DoorOpen className="size-4 text-ok" />} bookings={arrivals} rooms={rooms} empty="No more arrivals today." />
        <ListCard title="In-house" icon={<LogOut className="size-4 text-accent" />} bookings={inHouse} rooms={rooms} empty="No guests checked in." highlight={departures.map((d) => d.id)} />
        <ListCard title="Arriving tomorrow" icon={<Sunrise className="size-4 text-info" />} bookings={tomorrow} rooms={rooms} empty="No arrivals tomorrow yet." />
      </div>
    </div>
  );
}

function FoundBooking({ booking, rooms }: { booking: Booking; rooms: Room[] }) {
  return (
    <div className="mt-5 grid gap-5 rounded-xl border border-line bg-paper/50 p-5 md:grid-cols-[1fr_260px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xl font-bold">{booking.code}</span>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 font-medium">{booking.guestName}</p>
        <p className="text-sm text-muted">
          {booking.guestPhone} · {booking.guestEmail}
        </p>
        <div className="mt-4">
          <StaySummary nights={booking.nights} rooms={rooms} compact />
        </div>
        <p className="mt-3 text-sm">
          Paid <b>{formatPeso(booking.total)}</b>
        </p>
      </div>
      <div>
        {booking.status === "pending_verification" ? (
          <Alert tone="warn">Payment not yet verified. Review it in Bookings first.</Alert>
        ) : (
          <BookingActions booking={booking} />
        )}
        <Link href={`/admin/bookings/${booking.id}`} className="mt-3 block text-center text-xs text-muted hover:text-ink">
          View full details →
        </Link>
      </div>
    </div>
  );
}

function ListCard({
  title,
  icon,
  bookings,
  rooms,
  empty,
  highlight = [],
}: {
  title: string;
  icon: React.ReactNode;
  bookings: Booking[];
  rooms: Room[];
  empty: string;
  highlight?: string[];
}) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {icon} {title} <span className="text-sm font-normal text-muted">({bookings.length})</span>
          </span>
        }
      />
      {bookings.length === 0 ? (
        <EmptyState title={empty} className="py-8" />
      ) : (
        <ul className="divide-y divide-line">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="block px-5 py-3 hover:bg-paper">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{b.guestName}</span>
                  <span className="font-mono text-xs text-muted">{b.code}</span>
                </div>
                <p className="text-xs text-muted">{stayLabel(b, rooms)}</p>
                {highlight.includes(b.id) && <p className="mt-1 text-xs font-medium text-warn">Checking out today</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
