"use client";

import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import { cn, formatDate, formatPeso, toDateKey, todayKey } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function RatesPage() {
  return (
    <RequireRole roles={["owner"]}>
      <Rates />
    </RequireRole>
  );
}

function Rates() {
  const store = useStore();
  const toast = useToast();
  const today = todayKey();
  const { data } = useQuery(async (s) => {
    const [rooms, overrides] = await Promise.all([s.listRooms(), s.getRateOverrides()]);
    return { rooms, overrides };
  });
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [roomIds, setRoomIds] = useState<string[] | null>(null);
  const [days, setDays] = useState<Set<string>>(new Set());
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const monthDays = useMemo(
    () => eachDayOfInterval({ start: month, end: endOfMonth(month) }).map(toDateKey),
    [month],
  );

  if (!data) return <FullPageLoader />;
  const { rooms, overrides } = data;
  const selRooms = roomIds ?? rooms.map((r) => r.id);
  const shownRooms = rooms.filter((r) => selRooms.includes(r.id));
  const lead = (getDay(month) + 6) % 7; // Monday-first offset
  const futureDays = monthDays.filter((d) => d >= today);

  const toggleDay = (d: string) => {
    if (d < today) return;
    const next = new Set(days);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setDays(next);
  };

  const apply = async (value: number | null) => {
    if (!days.size || !selRooms.length) return;
    if (value !== null && !(value > 0)) return toast("Enter a valid rate.", "bad");
    setBusy(value === null ? "reset" : "apply");
    try {
      await store.setRateOverrides(selRooms, [...days], value);
      toast(
        value === null
          ? `Reset ${days.size} date(s) to base rates.`
          : `Set ${formatPeso(value)} on ${days.size} date(s) for ${selRooms.length} room(s).`,
      );
      setDays(new Set());
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(null);
    }
  };

  const upcoming = rooms
    .flatMap((r) =>
      Object.entries(overrides[r.id] ?? {})
        .filter(([d]) => d >= today)
        .map(([d, v]) => ({ room: r, date: d, rate: v })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.room.sortOrder - b.room.sortOrder);

  return (
    <div>
      <PageHeader
        title="Rates"
        description="Each room has a base nightly rate (edit it on the Rooms page). Pick dates here to set special rates for holidays, fiestas or peak weekends."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMonth((m) => subMonths(m, 1))}
                disabled={month <= startOfMonth(new Date())}
                aria-label="Previous month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="w-36 text-center font-semibold">{format(month, "MMMM yyyy")}</span>
              <Button variant="secondary" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = new Set(days);
                  futureDays.filter((d) => [5, 6].includes(new Date(d + "T00:00").getDay())).forEach((d) => next.add(d));
                  setDays(next);
                }}
              >
                + Fri & Sat
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDays(new Set([...days, ...futureDays]))}>
                + Whole month
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDays(new Set())} disabled={!days.size}>
                Clear
              </Button>
            </div>
          </div>
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted sm:gap-1.5">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {Array.from({ length: lead }, (_, i) => (
                <div key={`l${i}`} />
              ))}
              {monthDays.map((d) => {
                const past = d < today;
                const sel = days.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    onClick={() => toggleDay(d)}
                    aria-pressed={sel}
                    className={cn(
                      "min-h-20 rounded-lg border p-1.5 text-left transition sm:min-h-24 sm:p-2",
                      past && "cursor-not-allowed opacity-40",
                      sel ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink",
                    )}
                  >
                    <span className={cn("block text-xs font-semibold", d === today && !sel && "text-accent")}>
                      {formatDate(d, "d")}
                    </span>
                    <span className="mt-1 block space-y-0.5">
                      {shownRooms.map((r) => {
                        const o = overrides[r.id]?.[d];
                        return (
                          <span
                            key={r.id}
                            className={cn(
                              "block truncate text-[10px] leading-tight sm:text-[11px]",
                              o !== undefined ? (sel ? "font-semibold" : "font-semibold text-accent") : sel ? "text-white/70" : "text-muted",
                            )}
                            title={`${r.name}: ${formatPeso(o ?? r.baseRate)}`}
                          >
                            <span className="hidden sm:inline">{r.name.replace("Room ", "R")} </span>₱
                            {(o ?? r.baseRate).toLocaleString()}
                          </span>
                        );
                      })}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Tag className="size-3.5 text-accent" /> Highlighted amounts are special rates. Tap dates to select them.
            </p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Apply to</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {rooms.map((r) => {
                const on = selRooms.includes(r.id);
                return (
                  <button
                    key={r.id}
                    aria-pressed={on}
                    onClick={() => setRoomIds(on ? selRooms.filter((x) => x !== r.id) : [...selRooms, r.id])}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm",
                      on ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink",
                    )}
                  >
                    {r.name} <span className="opacity-70">· {formatPeso(r.baseRate)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm">
              <b>{days.size}</b> date{days.size === 1 ? "" : "s"} selected
            </p>
            <Field label="Special rate per night (₱)" className="mt-3">
              <Input type="number" min={1} step={50} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 1500" />
            </Field>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => apply(Number(rate))}
                disabled={!days.size || !selRooms.length || !rate}
                loading={busy === "apply"}
              >
                Apply special rate
              </Button>
              <Button variant="secondary" onClick={() => apply(null)} disabled={!days.size || !selRooms.length} loading={busy === "reset"}>
                Reset to base rate
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              New rates apply to new reservations only — existing bookings keep the price the guest paid.
            </p>
          </Card>

          <Card>
            <CardHeader title="Upcoming special rates" description={`${upcoming.length} room-date(s)`} />
            <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
              {upcoming.length === 0 && <li className="px-5 py-6 text-center text-muted">None set.</li>}
              {upcoming.map((u) => (
                <li key={`${u.room.id}${u.date}`} className="flex items-center justify-between px-5 py-2">
                  <span>
                    {formatDate(u.date, "EEE, MMM d, yyyy")} · <span className="text-muted">{u.room.name}</span>
                  </span>
                  <span className="font-medium">
                    {formatPeso(u.rate)}
                    <span className="ml-1 text-xs text-muted line-through">{formatPeso(u.room.baseRate)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
