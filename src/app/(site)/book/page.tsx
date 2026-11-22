"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarRange, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useAuth, useQuery, useStore } from "@/lib/data/provider";
import { addDaysKey, cn, daysBetweenKeys, formatDate, formatPeso, todayKey } from "@/lib/format";
import type { BookingNight } from "@/lib/types";
import { AvailabilityGrid, cellKey, GridLegend } from "@/components/availability-grid";
import { StaySummary } from "@/components/stay-summary";
import { HoldCountdown } from "@/components/hold-countdown";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const SELECTION_KEY = "vv-pending-selection";
const VISIBLE_DAYS = 14;

function loadSelection(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SELECTION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSelection(sel: Set<string>) {
  try {
    if (sel.size) sessionStorage.setItem(SELECTION_KEY, JSON.stringify([...sel]));
    else sessionStorage.removeItem(SELECTION_KEY);
  } catch {
    /* ignore */
  }
}

export default function BookPage() {
  const store = useStore();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const highlightRoom = params.get("room");
  const today = todayKey();

  const { data } = useQuery(async (s) => {
    const settings = await s.getSettings();
    const availability = await s.getAvailability(today, settings.bookingWindowDays);
    const holds = user ? await s.listBookings({ statuses: ["hold"] }) : [];
    return { settings, availability, hold: holds.find((b) => b.userId === user?.id) };
  }, [today, user?.id]);

  const [start, setStart] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(loadSelection);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState(() => ({
    checkIn: today,
    checkOut: addDaysKey(today, 1),
    rooms: highlightRoom ? [highlightRoom] : ([] as string[]),
  }));

  const update = (next: Set<string>) => {
    setSelected(next);
    saveSelection(next);
  };

  // Only keep selections that are still available (another guest may have just booked them).
  const { nights, dropped } = useMemo(() => {
    const out: BookingNight[] = [];
    let lost = 0;
    if (!data) return { nights: out, dropped: 0 };
    for (const k of selected) {
      const [roomId, date] = k.split("|");
      const cell = data.availability.cells[roomId]?.[date];
      if (cell?.status === "available") out.push({ roomId, date, rate: cell.rate });
      else lost++;
    }
    return { nights: out, dropped: lost };
  }, [selected, data]);

  if (!data) return <FullPageLoader />;
  const { availability, settings, hold } = data;
  const lastStart = addDaysKey(today, settings.bookingWindowDays - VISIBLE_DAYS);
  const dates = availability.dates.filter((d) => d >= start).slice(0, VISIBLE_DAYS);
  const total = nights.reduce((s, n) => s + n.rate, 0);
  const bookableRooms = availability.rooms.filter((r) => r.active);

  const toggle = (roomId: string, date: string) => {
    const next = new Set(selected);
    const k = cellKey(roomId, date);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    update(next);
  };

  const shift = (days: number) => {
    const n = addDaysKey(start, days);
    setStart(n < today ? today : n > lastStart ? lastStart : n);
  };

  const applyQuick = () => {
    const count = daysBetweenKeys(quick.checkIn, quick.checkOut);
    if (count < 1) return toast("Check-out must be after check-in.", "bad");
    if (!quick.rooms.length) return toast("Choose at least one room.", "bad");
    const next = new Set(selected);
    let unavailable = 0;
    for (const roomId of quick.rooms) {
      for (let i = 0; i < count; i++) {
        const d = addDaysKey(quick.checkIn, i);
        if (availability.cells[roomId]?.[d]?.status === "available") next.add(cellKey(roomId, d));
        else unavailable++;
      }
    }
    update(next);
    setStart(quick.checkIn > lastStart ? lastStart : quick.checkIn);
    if (unavailable) toast(`${unavailable} night(s) were already taken and were skipped.`, "bad");
  };

  const reserve = async () => {
    if (!nights.length) return;
    if (!user) {
      saveSelection(new Set(nights.map((n) => cellKey(n.roomId, n.date))));
      router.push(`/login?next=${encodeURIComponent("/book")}`);
      return;
    }
    setBusy(true);
    try {
      const booking = await store.createHold(nights.map(({ roomId, date }) => ({ roomId, date })));
      update(new Set());
      router.push(`/checkout/${booking.id}`);
    } catch (e) {
      toast(errorMessage(e), "bad");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-40 lg:pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Check availability</h1>
          <p className="mt-1 text-sm text-muted">
            Tap the nights you want.
          </p>
        </div>
      </div>

      {hold?.holdExpiresAt && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
          <span>
            You have a reservation on hold (<b>{hold.code}</b>, {formatPeso(hold.total)}). Finish paying before it
            expires.
          </span>
          <span className="flex items-center gap-3">
            <HoldCountdown expiresAt={hold.holdExpiresAt} />
            <Link href={`/checkout/${hold.id}`} className="font-semibold underline underline-offset-2">
              Continue to payment
            </Link>
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {/* Quick select */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <CalendarRange className="size-4 text-accent" /> Quick select a date range
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
              <Field label="Check-in">
                <Input
                  type="date"
                  min={today}
                  max={addDaysKey(today, settings.bookingWindowDays - 1)}
                  value={quick.checkIn}
                  onChange={(e) =>
                    setQuick((q) => ({
                      ...q,
                      checkIn: e.target.value,
                      checkOut: q.checkOut <= e.target.value ? addDaysKey(e.target.value, 1) : q.checkOut,
                    }))
                  }
                />
              </Field>
              <Field label="Check-out">
                <Input
                  type="date"
                  min={addDaysKey(quick.checkIn, 1)}
                  max={addDaysKey(today, settings.bookingWindowDays)}
                  value={quick.checkOut}
                  onChange={(e) => setQuick((q) => ({ ...q, checkOut: e.target.value }))}
                />
              </Field>
              <fieldset className="col-span-2 sm:col-span-1">
                <legend className="mb-1.5 text-sm font-medium">Rooms</legend>
                <div className="flex flex-wrap gap-1.5">
                  {bookableRooms.map((r) => {
                    const on = quick.rooms.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setQuick((q) => ({
                            ...q,
                            rooms: on ? q.rooms.filter((x) => x !== r.id) : [...q.rooms, r.id],
                          }))
                        }
                        className={cn(
                          "h-10 rounded-lg border px-3 text-sm transition",
                          on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:border-ink",
                        )}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Button variant="secondary" onClick={applyQuick} className="col-span-2 sm:col-span-1">
                Select
              </Button>
            </div>
          </Card>

          {/* Grid controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => shift(-7)} disabled={start <= today} aria-label="Previous week">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setStart(today)} disabled={start === today}>
                Today
              </Button>
              <Button variant="secondary" size="sm" onClick={() => shift(7)} disabled={start >= lastStart} aria-label="Next week">
                <ChevronRight className="size-4" />
              </Button>
              <span className="ml-1 text-sm font-medium">
                {formatDate(dates[0], "MMM d")} – {formatDate(dates[dates.length - 1], "MMM d, yyyy")}
              </span>
            </div>
            <span className="text-xs text-muted">Bookable up to {settings.bookingWindowDays} days ahead</span>
          </div>

          <AvailabilityGrid
            availability={availability}
            dates={dates}
            selected={selected}
            onToggle={toggle}
            highlightRoom={highlightRoom}
          />
          <GridLegend />
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="hidden p-5 lg:block">
            <SummaryBody
              nights={nights}
              total={total}
              dropped={dropped}
              rooms={availability.rooms}
              onClear={() => update(new Set())}
              onReserve={reserve}
              busy={busy}
              loggedIn={!!user}
              holdMinutes={settings.holdMinutes}
            />
          </Card>
        </aside>
      </div>

      {/* Mobile sticky summary */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">
              {nights.length ? `${nights.length} room-night${nights.length > 1 ? "s" : ""} selected` : "No nights selected"}
            </p>
            <p className="text-lg font-semibold tabular-nums">{formatPeso(total)}</p>
          </div>
          <div className="flex items-center gap-2">
            {nights.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => update(new Set())} aria-label="Clear selection">
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button onClick={reserve} disabled={!nights.length} loading={busy}>
              {user ? "Reserve & pay" : "Log in to reserve"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryBody({
  nights,
  total,
  dropped,
  rooms,
  onClear,
  onReserve,
  busy,
  loggedIn,
  holdMinutes,
}: {
  nights: BookingNight[];
  total: number;
  dropped: number;
  rooms: import("@/lib/types").Room[];
  onClear: () => void;
  onReserve: () => void;
  busy: boolean;
  loggedIn: boolean;
  holdMinutes: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Your selection</h2>
        {nights.length > 0 && (
          <button onClick={onClear} className="text-xs text-muted hover:text-bad">
            Clear
          </button>
        )}
      </div>
      {dropped > 0 && (
        <p className="mt-2 rounded-md bg-warn-soft px-2 py-1.5 text-xs text-warn">
          {dropped} selected night(s) were just taken by someone else and were removed.
        </p>
      )}
      <div className="mt-4">
        {nights.length ? (
          <StaySummary nights={nights} rooms={rooms} />
        ) : (
          <p className="py-6 text-center text-sm text-muted">No nights selected.</p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Total</span>
        <span className="text-xl font-semibold tabular-nums">{formatPeso(total)}</span>
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={onReserve} disabled={!nights.length} loading={busy}>
        {loggedIn ? "Reserve & pay" : "Log in to reserve"} <ArrowRight className="size-4" />
      </Button>
      <p className="mt-3 text-center text-xs text-muted">
        Held {holdMinutes} min while you pay.
      </p>
    </div>
  );
}
