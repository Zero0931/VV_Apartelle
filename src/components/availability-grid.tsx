"use client";

import { Check } from "lucide-react";
import { cn, formatDate, formatPeso, todayKey } from "@/lib/format";
import type { Availability, AvailabilityCell } from "@/lib/types";

export const cellKey = (roomId: string, date: string) => `${roomId}|${date}`;

const LABEL: Partial<Record<AvailabilityCell["status"], string>> = {
  booked: "Booked",
  held: "On hold",
  "my-hold": "Your hold",
  closed: "Closed",
  past: "—",
};

export function AvailabilityGrid({
  availability,
  dates,
  selected,
  onToggle,
  highlightRoom,
}: {
  availability: Availability;
  dates: string[];
  selected: Set<string>;
  onToggle: (roomId: string, date: string) => void;
  highlightRoom?: string | null;
}) {
  const today = todayKey();
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-16 min-w-16 border-b border-r border-line bg-surface px-2 py-2 text-left text-xs font-medium text-muted sm:w-auto sm:min-w-[112px] sm:px-3">
              Room
            </th>
            {dates.map((d) => {
              const dt = new Date(d + "T00:00");
              const weekend = dt.getDay() === 5 || dt.getDay() === 6;
              return (
                <th
                  key={d}
                  className={cn(
                    "min-w-[52px] border-b border-line px-0.5 py-2 text-center font-normal sm:min-w-[76px] sm:px-1",
                    weekend && "bg-paper",
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-wide text-muted">
                    {d === today ? "Tonight" : formatDate(d, "EEE")}
                  </span>
                  <span className={cn("block text-base font-semibold", d === today && "text-accent")}>
                    {formatDate(d, "d")}
                  </span>
                  <span className="block text-[11px] text-subtle">{formatDate(d, "MMM")}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {availability.rooms.map((room) => (
            <tr key={room.id} className={cn(highlightRoom === room.id && "bg-accent-soft/40")}>
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 max-w-16 border-b border-r border-line px-2 py-2 text-left font-normal sm:max-w-none sm:px-3",
                  highlightRoom === room.id ? "bg-accent-soft" : "bg-surface",
                )}
              >
                <span className="line-clamp-2 break-words text-xs font-semibold sm:text-sm">{room.name}</span>
                <span className="hidden text-xs text-muted sm:block">{room.tagline}</span>
              </th>
              {dates.map((d) => {
                const cell = availability.cells[room.id]?.[d];
                if (!cell) return <td key={d} className="border-b border-line" />;
                const isSel = selected.has(cellKey(room.id, d));
                const selectable = cell.status === "available";
                return (
                  <td key={d} className="border-b border-line p-0.5 sm:p-1">
                    {selectable ? (
                      <button
                        type="button"
                        onClick={() => onToggle(room.id, d)}
                        aria-pressed={isSel}
                        aria-label={`${room.name}, night of ${formatDate(d)}, ${formatPeso(cell.rate)}${isSel ? ", selected" : ""}`}
                        className={cn(
                          "flex h-12 w-full flex-col items-center justify-center rounded-lg border text-xs transition-colors sm:h-14",
                          isSel
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-surface hover:border-ink hover:bg-paper",
                        )}
                      >
                        {isSel ? <Check className="size-4" /> : <span className="hidden text-[10px] text-ok sm:inline">Open</span>}
                        <span className={cn("font-semibold", !isSel && cell.overridden && "text-accent")}>
                          ₱{cell.rate.toLocaleString()}
                        </span>
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex h-12 w-full items-center justify-center rounded-lg text-[11px] font-medium sm:h-14",
                          cell.status === "booked" && "hatch bg-paper text-subtle",
                          cell.status === "held" && "bg-warn-soft text-warn",
                          cell.status === "my-hold" && "bg-info-soft text-info",
                          cell.status === "closed" && "hatch bg-paper text-subtle",
                          cell.status === "past" && "text-subtle",
                        )}
                        title={LABEL[cell.status]}
                      >
                        {LABEL[cell.status]}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GridLegend() {
  const items = [
    { cls: "border border-line bg-surface", label: "Available (tap to select)" },
    { cls: "bg-ink", label: "Selected" },
    { cls: "bg-warn-soft border border-warn/30", label: "On hold by another guest" },
    { cls: "hatch bg-paper border border-line", label: "Booked" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className={cn("size-3.5 rounded", i.cls)} />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span className="font-semibold text-accent">₱</span> Special rate (holiday/peak)
      </li>
    </ul>
  );
}
