"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BadgeCheck, CalendarClock, DoorOpen, Users } from "lucide-react";
import { useAuth, useQuery } from "@/lib/data/provider";
import { cn, formatDateTime, formatPeso, METHOD_LABEL, stayLabel } from "@/lib/format";
import type { PeriodKey, PeriodStat } from "@/lib/analytics";
import { MeterList, RevenueChart } from "@/components/charts";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FullPageLoader } from "@/components/ui/spinner";

export default function AdminHome() {
  const { isOwner } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isOwner) router.replace("/admin/bookings");
  }, [isOwner, router]);
  if (!isOwner) return <FullPageLoader />;
  return <Dashboard />;
}

function Change({ cur, prev, pct, vs }: { cur: number; prev: number; pct?: boolean; vs?: string }) {
  if (!prev && !cur) return <span className="text-xs text-muted">No data yet</span>;
  const diff = pct ? (cur - prev) * 100 : prev ? ((cur - prev) / prev) * 100 : 100;
  const up = diff >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium", up ? "text-ok" : "text-bad")}>
      <Icon className="size-3.5" />
      {Math.abs(diff).toFixed(pct ? 1 : 0)}
      {pct ? " pts" : "%"}
      {vs && <span className="ml-1 font-normal text-muted">{vs}</span>}
    </span>
  );
}

function PeriodCard({ p }: { p: PeriodStat }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{p.label}</h3>
        <span className="text-xs text-muted">{p.rangeLabel}</span>
      </div>
      <p className="mt-4 text-xs text-muted">Gross revenue</p>
      <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatPeso(p.revenue)}</p>
      <Change cur={p.revenue} prev={p.prevRevenue} vs={`vs same point last ${p.key}`} />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <div>
          <p className="text-xs text-muted">Occupancy</p>
          <p className="text-xl font-semibold tabular-nums">{(p.occupancy * 100).toFixed(0)}%</p>
          <Change cur={p.occupancy} prev={p.prevOccupancy} pct />
        </div>
        <div>
          <p className="text-xs text-muted">Room-nights sold</p>
          <p className="text-xl font-semibold tabular-nums">{p.nightsSold}</p>
        </div>
      </div>
    </Card>
  );
}

function Dashboard() {
  const { data } = useQuery(async (s) => {
    const [stats, rooms] = await Promise.all([s.getDashboardStats(), s.listRooms({ includeArchived: true })]);
    return { stats, rooms };
  });
  const [series, setSeries] = useState<"daily" | "weekly" | "monthly">("daily");
  const [occPeriod, setOccPeriod] = useState<PeriodKey>("month");

  if (!data) return <FullPageLoader />;
  const { stats, rooms } = data;
  const mixMax = Math.max(...stats.paymentMix.map((m) => m.amount), 1);
  const totalSeries = stats.revenueSeries[series].reduce((s, p) => s + p.value, 0);

  const tiles = [
    {
      label: "Registered customers",
      value: stats.customers.total,
      sub: `+${stats.customers.newThisMonth} this month`,
      icon: Users,
      href: "/admin/customers",
    },
    {
      label: "Payments to verify",
      value: stats.pendingVerification,
      sub: stats.activeHolds ? `${stats.activeHolds} reservation(s) on hold` : "No active holds",
      icon: BadgeCheck,
      href: "/admin/bookings",
      alert: stats.pendingVerification > 0,
    },
    {
      label: "Arrivals today · In-house",
      value: `${stats.arrivalsToday} · ${stats.inHouse}`,
      sub: "Go to front desk",
      icon: DoorOpen,
      href: "/admin/check-in",
    },
    {
      label: "Upcoming paid revenue",
      value: formatPeso(stats.upcomingRevenue),
      sub: "Confirmed nights after today",
      icon: CalendarClock,
      href: "/admin/bookings",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Performance of your rooms · updated ${formatDateTime(stats.generatedAt)}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={cn(
              "rounded-xl border bg-surface p-4 transition hover:border-ink",
              t.alert ? "border-accent" : "border-line",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted">{t.label}</p>
              <t.icon className={cn("size-4", t.alert ? "text-accent" : "text-subtle")} />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{t.value}</p>
            <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.periods.map((p) => (
          <PeriodCard key={p.key} p={p} />
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted">
        Gross revenue = paid bookings (confirmed, in-house, completed) counted on each night of stay, period-to-date.
        Occupancy = room-nights sold ÷ room-nights available.
      </p>

      <Card>
        <CardHeader
          title="Gross revenue"
          description={`${formatPeso(totalSeries)} in the selected range`}
          action={
            <Segmented
              value={series}
              onChange={setSeries}
              options={[
                { value: "daily", label: "30 days" },
                { value: "weekly", label: "12 weeks" },
                { value: "monthly", label: "12 months" },
              ]}
            />
          }
        />
        <div className="px-3 py-4 sm:px-5">
          <RevenueChart data={stats.revenueSeries[series]} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Occupancy by room"
            action={
              <Segmented
                value={occPeriod}
                onChange={setOccPeriod}
                options={[
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />
            }
          />
          <div className="px-5 py-5">
            <MeterList
              rows={stats.occupancyByRoom[occPeriod].map((r) => ({
                key: r.roomId,
                label: r.name,
                value: r.occupancy,
                max: 1,
                display: `${(r.occupancy * 100).toFixed(0)}%`,
                sub: `${r.nights} nights · ${formatPeso(r.revenue)}`,
              }))}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment channels" description="Paid bookings this year" />
          <div className="px-5 py-5">
            <MeterList
              rows={stats.paymentMix.map((m) => ({
                key: m.method,
                label: METHOD_LABEL[m.method],
                value: m.amount,
                max: mixMax,
                display: formatPeso(m.amount),
                sub: `${m.count} bookings`,
              }))}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent bookings"
          action={
            <Link href="/admin/bookings" className="text-sm font-medium text-accent hover:underline">
              View all
            </Link>
          }
        />
        <ul className="divide-y divide-line">
          {stats.recent.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-paper">
                <span className="w-24 font-mono text-sm font-semibold">{b.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{b.guestName}</span>
                  <span className="block truncate text-xs text-muted">{stayLabel(b, rooms)}</span>
                </span>
                <span className="text-sm font-medium tabular-nums">{formatPeso(b.total)}</span>
                <StatusBadge status={b.status} />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-paper p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition",
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
