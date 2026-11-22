import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { BookingNight, BookingStatus, PaymentMethod, Room } from "./types";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function formatPeso(n: number) {
  return peso.format(n);
}

export function formatPesoCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `₱${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `₱${n}`;
}

/** yyyy-MM-dd in the browser's local time (Asia/Manila for the property). */
export function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function todayKey() {
  return toDateKey(new Date());
}

export function fromDateKey(key: string) {
  return parseISO(key);
}

export function addDaysKey(key: string, n: number) {
  return toDateKey(addDays(parseISO(key), n));
}

export function daysBetweenKeys(a: string, b: string) {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

export function formatDate(key: string, pattern = "EEE, MMM d, yyyy") {
  return format(parseISO(key), pattern);
}

export function formatDateTime(iso: string) {
  return format(new Date(iso), "MMM d, yyyy · h:mm a");
}

export function formatTime12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  if (h === 12 && m === 0) return "12:00 NN";
  return format(d, "h:mm a");
}

export interface Stay {
  roomId: string;
  checkIn: string; // first night
  checkOut: string; // morning after last night
  nights: number;
  subtotal: number;
  rates: BookingNight[];
}

/** Groups room-nights into consecutive stays per room for display. */
export function groupStays(nights: BookingNight[], rooms?: Room[]): Stay[] {
  const order = new Map(rooms?.map((r) => [r.id, r.sortOrder]) ?? []);
  const sorted = [...nights].sort((a, b) =>
    a.roomId === b.roomId
      ? a.date.localeCompare(b.date)
      : (order.get(a.roomId) ?? 0) - (order.get(b.roomId) ?? 0) || a.roomId.localeCompare(b.roomId),
  );
  const stays: Stay[] = [];
  for (const n of sorted) {
    const last = stays[stays.length - 1];
    if (last && last.roomId === n.roomId && last.checkOut === n.date) {
      last.checkOut = addDaysKey(n.date, 1);
      last.nights += 1;
      last.subtotal += n.rate;
      last.rates.push(n);
    } else {
      stays.push({
        roomId: n.roomId,
        checkIn: n.date,
        checkOut: addDaysKey(n.date, 1),
        nights: 1,
        subtotal: n.rate,
        rates: [n],
      });
    }
  }
  return stays;
}

export function firstNight(nights: BookingNight[]) {
  return nights.reduce((m, n) => (n.date < m ? n.date : m), nights[0]?.date ?? "");
}

export function lastNight(nights: BookingNight[]) {
  return nights.reduce((m, n) => (n.date > m ? n.date : m), nights[0]?.date ?? "");
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  hold: "On hold",
  pending_verification: "Verifying payment",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  completed: "Completed",
  expired: "Hold expired",
  rejected: "Payment rejected",
  cancelled: "Cancelled",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
};

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function stayLabel(b: { nights: BookingNight[] }, rooms: Room[]) {
  const names = [...new Set(b.nights.map((n) => rooms.find((r) => r.id === n.roomId)?.name ?? "Room"))];
  return `${names.join(", ")} · ${formatDate(firstNight(b.nights), "MMM d")} → ${formatDate(addDaysKey(lastNight(b.nights), 1), "MMM d")}`;
}
