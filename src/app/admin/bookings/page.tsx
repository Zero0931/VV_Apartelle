"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList, Search } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { cn, firstNight, formatDateTime, formatPeso, METHOD_LABEL, stayLabel } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { FullPageLoader } from "@/components/ui/spinner";

const TABS: { key: string; label: string; statuses: BookingStatus[] | null }[] = [
  { key: "verify", label: "Needs verification", statuses: ["pending_verification"] },
  { key: "upcoming", label: "Confirmed", statuses: ["confirmed"] },
  { key: "inhouse", label: "In-house", statuses: ["checked_in"] },
  { key: "hold", label: "On hold", statuses: ["hold"] },
  { key: "history", label: "History", statuses: ["completed", "cancelled", "rejected", "expired"] },
  { key: "all", label: "All", statuses: null },
];

export default function AdminBookingsPage() {
  const { data } = useQuery(async (s) => {
    const [bookings, rooms] = await Promise.all([s.listBookings(), s.listRooms({ includeArchived: true })]);
    return { bookings, rooms };
  });
  const [tab, setTab] = useState("verify");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of TABS) c[t.key] = data?.bookings.filter((b) => !t.statuses || t.statuses.includes(b.status)).length ?? 0;
    return c;
  }, [data]);

  if (!data) return <FullPageLoader />;
  const active = TABS.find((t) => t.key === tab)!;
  const term = q.trim().toLowerCase();
  let list = data.bookings.filter((b) => !active.statuses || active.statuses.includes(b.status));
  if (term)
    list = list.filter((b) =>
      [b.code, b.guestName, b.guestEmail, b.guestPhone, b.payment?.referenceNo ?? ""].some((v) => v.toLowerCase().includes(term)),
    );
  if (tab === "upcoming" || tab === "verify")
    list = [...list].sort((a, b) => firstNight(a.nights).localeCompare(firstNight(b.nights)));
  const shown = list.slice(0, 200);

  return (
    <div>
      <PageHeader title="Bookings" description="Verify payments, and manage reservations from every guest." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                tab === t.key ? "bg-ink text-white" : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px]",
                  tab === t.key ? "bg-white/20" : t.key === "verify" && counts[t.key] ? "bg-accent text-white" : "bg-ink/5",
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, guest, phone, ref no." className="pl-9" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-10" />} title="Nothing here">
            {tab === "verify" ? "No payments waiting for verification. 🎉" : "No bookings match this filter."}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-line bg-paper/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Booking</th>
                  <th className="px-4 py-2.5 font-medium">Guest</th>
                  <th className="px-4 py-2.5 font-medium">Stay</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((b) => (
                  <tr key={b.id} className="group relative transition hover:bg-paper/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold after:absolute after:inset-0">
                        {b.code}
                      </Link>
                      <p className="text-xs text-muted">{formatDateTime(b.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.guestName}</p>
                      <p className="text-xs text-muted">{b.guestPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{stayLabel(b, data.rooms)}</p>
                      <p className="text-xs text-muted">{b.nights.length} room-night(s)</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {b.payment ? (
                        <>
                          <p className="font-medium">{METHOD_LABEL[b.payment.method]}</p>
                          <p className="font-mono text-muted">{b.payment.referenceNo}</p>
                        </>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatPeso(b.total)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="pr-3">
                      <ChevronRight className="size-4 text-subtle group-hover:text-ink" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="block px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{b.code}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium">{b.guestName}</p>
                    <p className="text-xs text-muted">{stayLabel(b, data.rooms)}</p>
                    <p className="mt-1 text-sm font-medium">{formatPeso(b.total)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {list.length > shown.length && (
        <p className="mt-3 text-center text-xs text-muted">Showing first {shown.length} of {list.length}. Use search to narrow down.</p>
      )}
    </div>
  );
}
