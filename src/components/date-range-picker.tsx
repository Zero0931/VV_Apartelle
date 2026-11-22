"use client";

import { useState } from "react";
import { addMonths, format, getDay, getDaysInMonth, startOfMonth } from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, daysBetweenKeys, formatDate, fromDateKey, toDateKey } from "@/lib/format";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const monthKey = (key: string) => key.slice(0, 7);

export function DateRangePicker({
  checkIn,
  checkOut,
  min,
  max,
  onChange,
}: {
  checkIn: string;
  checkOut: string;
  /** First selectable check-in (usually today). */
  min: string;
  /** Last selectable check-out. */
  max: string;
  onChange: (range: { checkIn: string; checkOut: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthKey(checkIn));
  // Check-in tapped, waiting for check-out.
  const [draftIn, setDraftIn] = useState<string | null>(null);

  const nights = daysBetweenKeys(checkIn, checkOut);
  const first = startOfMonth(fromDateKey(`${month}-01`));
  const lead = getDay(first);
  const days = Array.from({ length: getDaysInMonth(first) }, (_, i) =>
    toDateKey(new Date(first.getFullYear(), first.getMonth(), i + 1)),
  );
  const canPrev = month > monthKey(min);
  const canNext = month < monthKey(max);

  const toggleOpen = () => {
    if (!open) setMonth(monthKey(checkIn));
    setDraftIn(null);
    setOpen(!open);
  };

  const shiftMonth = (n: number) => setMonth(format(addMonths(first, n), "yyyy-MM"));

  const pick = (d: string) => {
    if (draftIn && d > draftIn) {
      onChange({ checkIn: draftIn, checkOut: d });
      setDraftIn(null);
      setOpen(false);
    } else {
      setDraftIn(d);
    }
  };

  const rangeIn = draftIn ?? checkIn;
  const rangeOut = draftIn ? null : checkOut;

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex h-10 w-full min-w-0 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-left text-sm hover:border-ink"
      >
        <CalendarRange className="size-4 shrink-0 text-accent" />
        <span className="truncate font-medium">
          {formatDate(checkIn, "MMM d")} → {formatDate(checkOut, "MMM d")}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted">
          {nights} night{nights === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-line bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canPrev}
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-md hover:bg-paper disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{format(first, "MMMM yyyy")}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canNext}
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-md hover:bg-paper disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] text-muted">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {days.map((d) => {
              // The last bookable day can only be a check-out.
              const disabled = d < min || d > max || (!draftIn && d === max);
              const isEnd = d === rangeIn || d === rangeOut;
              const inRange = rangeOut !== null && d > rangeIn && d < rangeOut;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(d)}
                  aria-label={formatDate(d)}
                  aria-pressed={isEnd}
                  className={cn(
                    "h-9 text-sm tabular-nums transition-colors",
                    disabled && "cursor-not-allowed text-subtle/40 line-through",
                    !disabled && !isEnd && !inRange && "rounded-md hover:bg-paper",
                    inRange && "bg-accent-soft",
                    isEnd && "rounded-md bg-ink font-semibold text-white",
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-center text-xs text-muted">
            {draftIn ? "Now tap check-out." : "Tap check-in, then check-out."}
          </p>
        </div>
      )}
    </div>
  );
}
