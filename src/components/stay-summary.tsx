import { BedDouble } from "lucide-react";
import { formatDate, formatPeso, groupStays } from "@/lib/format";
import type { BookingNight, Room } from "@/lib/types";

export function StaySummary({
  nights,
  rooms,
  compact,
}: {
  nights: BookingNight[];
  rooms: Room[];
  compact?: boolean;
}) {
  const stays = groupStays(nights, rooms);
  const roomName = (id: string) => {
    const r = rooms.find((x) => x.id === id);
    return r ? `${r.name} · ${r.tagline}` : "Room";
  };
  return (
    <ul className="divide-y divide-line">
      {stays.map((s) => (
        <li key={`${s.roomId}-${s.checkIn}`} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper">
            <BedDouble className="size-4 text-muted" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{roomName(s.roomId)}</p>
            <p className="text-xs text-muted">
              {formatDate(s.checkIn, "EEE, MMM d")} → {formatDate(s.checkOut, "EEE, MMM d")} · {s.nights} night
              {s.nights > 1 ? "s" : ""}
            </p>
            {!compact && s.rates.some((r) => r.rate !== s.rates[0].rate) && (
              <p className="mt-1 text-[11px] text-subtle">
                {s.rates.map((r) => `${formatDate(r.date, "MMM d")} ${formatPeso(r.rate)}`).join(" · ")}
              </p>
            )}
          </div>
          <span className="text-sm font-medium tabular-nums">{formatPeso(s.subtotal)}</span>
        </li>
      ))}
    </ul>
  );
}
