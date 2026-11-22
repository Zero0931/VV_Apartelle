"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { formatDate, formatPeso, lastNight } from "@/lib/format";
import { PAID_STATUSES } from "@/lib/types";
import { RequireRole } from "@/components/require-role";
import { Card, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { FullPageLoader } from "@/components/ui/spinner";

export default function CustomersPage() {
  return (
    <RequireRole roles={["owner"]}>
      <Customers />
    </RequireRole>
  );
}

function Customers() {
  const { data } = useQuery(async (s) => {
    const [users, bookings] = await Promise.all([s.listUsers("customer"), s.listBookings()]);
    return users
      .map((u) => {
        const mine = bookings.filter((b) => b.userId === u.id && PAID_STATUSES.includes(b.status));
        const last = mine.map((b) => lastNight(b.nights)).sort().at(-1);
        return {
          ...u,
          bookings: mine.length,
          nights: mine.reduce((s, b) => s + b.nights.length, 0),
          spent: mine.reduce((s, b) => s + b.total, 0),
          lastStay: last,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
  const [q, setQ] = useState("");
  if (!data) return <FullPageLoader />;
  const term = q.trim().toLowerCase();
  const list = term
    ? data.filter((c) => [c.name, c.email, c.phone].some((v) => v.toLowerCase().includes(term)))
    : data;
  const repeat = data.filter((c) => c.bookings > 1).length;

  return (
    <div>
      <PageHeader
        title="Customers"
        description={`${data.length} registered accounts · ${repeat} repeat guests`}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone" className="pl-9" />
          </div>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line bg-paper/60 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Mobile</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 text-right font-medium">Bookings</th>
              <th className="px-4 py-2.5 text-right font-medium">Nights</th>
              <th className="px-4 py-2.5 text-right font-medium">Total spent</th>
              <th className="px-4 py-2.5 font-medium">Last stay</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-paper/60">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted">{c.email}</p>
                </td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{formatDate(c.createdAt.slice(0, 10), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.bookings}</td>
                <td className="px-4 py-3 text-right tabular-nums">{c.nights}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{formatPeso(c.spent)}</td>
                <td className="px-4 py-3">{c.lastStay ? formatDate(c.lastStay, "MMM d, yyyy") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
