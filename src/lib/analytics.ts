import {
  addDays,
  eachDayOfInterval,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";
import { toDateKey } from "./format";
import { PAID_STATUSES, type Booking, type PaymentMethod, type PublicUser, type Room } from "./types";

export type PeriodKey = "week" | "month" | "year";

export interface PeriodStat {
  key: PeriodKey;
  label: string;
  rangeLabel: string;
  revenue: number;
  prevRevenue: number;
  occupancy: number; // 0..1
  prevOccupancy: number;
  nightsSold: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
  /** Tooltip detail, e.g. full date range. */
  detail: string;
}

export interface RoomOccupancy {
  roomId: string;
  name: string;
  occupancy: number;
  nights: number;
  revenue: number;
}

export interface DashboardStats {
  generatedAt: string;
  customers: { total: number; newThisMonth: number };
  periods: PeriodStat[];
  pendingVerification: number;
  activeHolds: number;
  upcomingRevenue: number;
  arrivalsToday: number;
  inHouse: number;
  revenueSeries: { daily: SeriesPoint[]; weekly: SeriesPoint[]; monthly: SeriesPoint[] };
  occupancyByRoom: Record<PeriodKey, RoomOccupancy[]>;
  paymentMix: { method: PaymentMethod; count: number; amount: number }[];
  recent: Booking[];
}

interface Index {
  revenueByDate: Map<string, number>;
  soldByRoomDate: Map<string, Map<string, number>>; // roomId -> date -> rate
}

function buildIndex(bookings: Booking[]): Index {
  const revenueByDate = new Map<string, number>();
  const soldByRoomDate = new Map<string, Map<string, number>>();
  for (const b of bookings) {
    if (!PAID_STATUSES.includes(b.status)) continue;
    for (const n of b.nights) {
      revenueByDate.set(n.date, (revenueByDate.get(n.date) ?? 0) + n.rate);
      let m = soldByRoomDate.get(n.roomId);
      if (!m) soldByRoomDate.set(n.roomId, (m = new Map()));
      m.set(n.date, n.rate);
    }
  }
  return { revenueByDate, soldByRoomDate };
}

function roomExistsOn(room: Room, date: string) {
  const created = toDateKey(new Date(room.createdAt));
  if (date < created) return false;
  if (room.archived && room.archivedAt && date >= toDateKey(new Date(room.archivedAt))) return false;
  return true;
}

function keysIn(start: Date, end: Date) {
  if (end < start) return [];
  return eachDayOfInterval({ start, end }).map(toDateKey);
}

function rangeStats(idx: Index, rooms: Room[], start: Date, end: Date) {
  const days = keysIn(start, end);
  let revenue = 0;
  let sold = 0;
  let capacity = 0;
  for (const d of days) {
    revenue += idx.revenueByDate.get(d) ?? 0;
    for (const r of rooms) {
      if (!roomExistsOn(r, d)) continue;
      capacity += 1;
      if (idx.soldByRoomDate.get(r.id)?.has(d)) sold += 1;
    }
  }
  return { revenue, sold, occupancy: capacity ? sold / capacity : 0 };
}

function periodStart(key: PeriodKey, d: Date) {
  if (key === "week") return startOfWeek(d, { weekStartsOn: 1 });
  if (key === "month") return startOfMonth(d);
  return startOfYear(d);
}

function shiftBack(key: PeriodKey, d: Date) {
  if (key === "week") return subWeeks(d, 1);
  if (key === "month") return subMonths(d, 1);
  return subYears(d, 1);
}

export function computeDashboard(
  bookings: Booking[],
  rooms: Room[],
  users: PublicUser[],
  now = new Date(),
): DashboardStats {
  const idx = buildIndex(bookings);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayK = toDateKey(today);

  const labels: Record<PeriodKey, string> = { week: "This week", month: "This month", year: "This year" };
  const periods: PeriodStat[] = (["week", "month", "year"] as PeriodKey[]).map((key) => {
    const start = periodStart(key, today);
    const cur = rangeStats(idx, rooms, start, today);
    const prev = rangeStats(idx, rooms, shiftBack(key, start), shiftBack(key, today));
    return {
      key,
      label: labels[key],
      rangeLabel: `${format(start, "MMM d")} – ${format(today, "MMM d")}`,
      revenue: cur.revenue,
      prevRevenue: prev.revenue,
      occupancy: cur.occupancy,
      prevOccupancy: prev.occupancy,
      nightsSold: cur.sold,
    };
  });

  // Revenue series (by night of stay, paid bookings only)
  const daily: SeriesPoint[] = keysIn(subDays(today, 29), today).map((k) => ({
    label: format(new Date(k + "T00:00"), "MMM d"),
    value: idx.revenueByDate.get(k) ?? 0,
    detail: format(new Date(k + "T00:00"), "EEE, MMM d, yyyy"),
  }));
  const weekly: SeriesPoint[] = [];
  const thisWeek = startOfWeek(today, { weekStartsOn: 1 });
  for (let i = 11; i >= 0; i--) {
    const s = subWeeks(thisWeek, i);
    const e = i === 0 ? today : addDays(s, 6);
    weekly.push({
      label: format(s, "MMM d"),
      value: rangeStats(idx, [], s, e).revenue,
      detail: `Week of ${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}${i === 0 ? " (to date)" : ""}`,
    });
  }
  const monthly: SeriesPoint[] = [];
  const thisMonth = startOfMonth(today);
  for (let i = 11; i >= 0; i--) {
    const s = subMonths(thisMonth, i);
    const e = i === 0 ? today : subDays(subMonths(thisMonth, i - 1), 1);
    monthly.push({
      label: format(s, "MMM"),
      value: rangeStats(idx, [], s, e).revenue,
      detail: `${format(s, "MMMM yyyy")}${i === 0 ? " (to date)" : ""}`,
    });
  }

  const occupancyByRoom = {} as Record<PeriodKey, RoomOccupancy[]>;
  for (const key of ["week", "month", "year"] as PeriodKey[]) {
    const start = periodStart(key, today);
    occupancyByRoom[key] = rooms
      .filter((r) => !r.archived || (r.archivedAt && toDateKey(new Date(r.archivedAt)) > toDateKey(start)))
      .map((r) => {
        const s = rangeStats(idx, [r], start, today);
        let revenue = 0;
        const sold = idx.soldByRoomDate.get(r.id);
        if (sold) for (const d of keysIn(start, today)) revenue += sold.get(d) ?? 0;
        return { roomId: r.id, name: r.name, occupancy: s.occupancy, nights: s.sold, revenue };
      });
  }

  const yearStart = toDateKey(startOfYear(today));
  const mix = new Map<PaymentMethod, { count: number; amount: number }>();
  for (const b of bookings) {
    if (!PAID_STATUSES.includes(b.status) || !b.payment) continue;
    if (b.createdAt.slice(0, 10) < yearStart) continue;
    const m = mix.get(b.payment.method) ?? { count: 0, amount: 0 };
    m.count += 1;
    m.amount += b.total;
    mix.set(b.payment.method, m);
  }

  let upcomingRevenue = 0;
  for (const [d, v] of idx.revenueByDate) if (d > todayK) upcomingRevenue += v;

  const customers = users.filter((u) => u.role === "customer");
  const monthStartIso = startOfMonth(today).toISOString();

  return {
    generatedAt: now.toISOString(),
    customers: {
      total: customers.length,
      newThisMonth: customers.filter((u) => u.createdAt >= monthStartIso).length,
    },
    periods,
    pendingVerification: bookings.filter((b) => b.status === "pending_verification").length,
    activeHolds: bookings.filter((b) => b.status === "hold").length,
    upcomingRevenue,
    arrivalsToday: bookings.filter(
      (b) => b.status === "confirmed" && b.nights.some((n) => n.date === todayK) && !b.nights.some((n) => n.date < todayK),
    ).length,
    inHouse: bookings.filter((b) => b.status === "checked_in").length,
    revenueSeries: { daily, weekly, monthly },
    occupancyByRoom,
    paymentMix: (["gcash", "maya", "bank"] as PaymentMethod[]).map((method) => ({
      method,
      ...(mix.get(method) ?? { count: 0, amount: 0 }),
    })),
    recent: [...bookings]
      .filter((b) => b.status !== "expired")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8),
  };
}
