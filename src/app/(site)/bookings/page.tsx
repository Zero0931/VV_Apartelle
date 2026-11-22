"use client";

import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { addDaysKey, firstNight, formatDate, formatPeso, lastNight, todayKey } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { FullPageLoader } from "@/components/ui/spinner";
import type { Booking, Room } from "@/lib/types";

export default function MyBookingsPage() {
  return (
    <RequireRole>
      <MyBookings />
    </RequireRole>
  );
}

function MyBookings() {
  const { data } = useQuery(async (s) => {
    const u = await s.getCurrentUser();
    const [bookings, rooms] = await Promise.all([
      s.listBookings({ userId: u?.id }),
      s.listRooms({ includeArchived: true }),
    ]);
    return { bookings: bookings.filter((b) => b.status !== "expired"), rooms };
  });
  if (!data) return <FullPageLoader />;

  const today = todayKey();
  const upcoming = data.bookings.filter(
    (b) => ["hold", "pending_verification", "confirmed", "checked_in"].includes(b.status) && lastNight(b.nights) >= today,
  );
  const past = data.bookings.filter((b) => !upcoming.includes(b));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        title="My bookings"
        description="Your reservations and receipts."
        action={<LinkButton href="/book">Book another stay</LinkButton>}
      />
      {data.bookings.length === 0 ? (
        <Card>
          <EmptyState icon={<Receipt className="size-10" />} title="No bookings yet">
            When you reserve a room it will show up here.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-8">
          <Section title="Upcoming & active" bookings={upcoming} rooms={data.rooms} />
          <Section title="Past & cancelled" bookings={past} rooms={data.rooms} />
        </div>
      )}
    </div>
  );
}

function Section({ title, bookings, rooms }: { title: string; bookings: Booking[]; rooms: Room[] }) {
  if (!bookings.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <Card className="divide-y divide-line">
        {bookings.map((b) => {
          const roomNames = [...new Set(b.nights.map((n) => rooms.find((r) => r.id === n.roomId)?.name ?? "Room"))];
          const href = b.status === "hold" ? `/checkout/${b.id}` : `/bookings/${b.id}`;
          return (
            <Link key={b.id} href={href} className="flex items-center gap-4 px-5 py-4 transition hover:bg-paper">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{b.code}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-1 truncate text-sm">
                  {roomNames.join(", ")} · {formatDate(firstNight(b.nights), "MMM d")} →{" "}
                  {formatDate(addDaysKey(lastNight(b.nights), 1), "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted">
                  {b.nights.length} room-night{b.nights.length > 1 ? "s" : ""} · {formatPeso(b.total)}
                </p>
              </div>
              <ChevronRight className="size-5 text-subtle" />
            </Link>
          );
        })}
      </Card>
    </section>
  );
}
