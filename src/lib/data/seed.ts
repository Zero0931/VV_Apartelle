import { addMinutes, subDays } from "date-fns";
import { addDaysKey, toDateKey } from "../format";
import { makeDemoReceiptImage, makeQrDataUrl } from "../images";
import type {
  Booking,
  BookingStatus,
  DB,
  EmailMessage,
  PaymentChannel,
  PaymentMethod,
  RateOverrides,
  Room,
  User,
} from "../types";

export const DB_VERSION = 1;

export const DEMO_ACCOUNTS = {
  owner: { email: "owner@vvapartelle.demo", password: "owner123" },
  admin: { email: "frontdesk@vvapartelle.demo", password: "admin123" },
  guest: { email: "juan@guest.demo", password: "guest123" },
} as const;

// Deterministic PRNG so the seeded history looks the same on every reset.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeBookingCode(rand: () => number = Math.random) {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return `VV-${s}`;
}

const FIRST = [
  "Maria", "Jose", "Ana", "Mark", "Kristine", "John Paul", "Angelica", "Ramon", "Jessa", "Carlo",
  "Princess", "Rodel", "Grace", "Jerome", "Mae", "Paolo", "Shiela", "Arnel", "Joy", "Kenneth",
  "Liza", "Romeo", "Hazel", "Vincent",
];
const LAST = [
  "Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos", "Aquino",
  "Navarro", "Castillo", "Flores", "Gonzales", "Lim", "Tan", "Dizon", "Ocampo", "Pascual", "Salazar",
  "Fernandez", "Lopez", "Morales", "Domingo",
];

const HOLIDAYS = ["12-24", "12-25", "12-30", "12-31", "01-01"];

export async function createSeed(now = new Date()): Promise<DB> {
  const rand = mulberry32(20261120);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const today = toDateKey(now);
  const iso = (d: Date) => d.toISOString();
  const opened = subDays(now, 760);

  const rooms: Room[] = [
    {
      id: "room-1",
      name: "Room 1",
      tagline: "Queen Room",
      description:
        "Cozy air-conditioned room with a queen-size bed, ideal for couples or solo travellers passing through Panabo.",
      capacity: 2,
      bedType: "1 Queen bed",
      amenities: ["Air-conditioned", "Free Wi-Fi", "Smart TV", "Hot & cold shower", "Private CR"],
      baseRate: 1200,
      active: true,
      archived: false,
      sortOrder: 1,
      createdAt: iso(opened),
    },
    {
      id: "room-2",
      name: "Room 2",
      tagline: "Twin Room",
      description:
        "Two single beds and a work desk — great for friends, colleagues, or business trips to Davao del Norte.",
      capacity: 2,
      bedType: "2 Single beds",
      amenities: ["Air-conditioned", "Free Wi-Fi", "Smart TV", "Work desk", "Hot & cold shower", "Private CR"],
      baseRate: 1300,
      active: true,
      archived: false,
      sortOrder: 2,
      createdAt: iso(opened),
    },
    {
      id: "room-3",
      name: "Room 3",
      tagline: "Family Room",
      description:
        "Our biggest room with a queen bed plus a double bed, a small dining nook and refrigerator — fits up to 4 guests.",
      capacity: 4,
      bedType: "1 Queen + 1 Double bed",
      amenities: ["Air-conditioned", "Free Wi-Fi", "Smart TV", "Refrigerator", "Dining nook", "Hot & cold shower", "Private CR"],
      baseRate: 1800,
      active: true,
      archived: false,
      sortOrder: 3,
      createdAt: iso(opened),
    },
  ];

  // Holiday surcharge overrides (+₱300) for the next season and last season.
  const rateOverrides: RateOverrides = {};
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  for (const r of rooms) {
    rateOverrides[r.id] = {};
    for (const y of years) {
      for (const md of HOLIDAYS) rateOverrides[r.id][`${y}-${md}`] = r.baseRate + 300;
    }
  }
  const rateOf = (r: Room, d: string) => rateOverrides[r.id]?.[d] ?? r.baseRate;

  const users: User[] = [
    {
      id: "u_owner",
      name: "VV Apartelle Owner",
      email: DEMO_ACCOUNTS.owner.email,
      phone: "0917 000 0001",
      role: "owner",
      password: DEMO_ACCOUNTS.owner.password,
      createdAt: iso(opened),
    },
    {
      id: "u_admin",
      name: "Front Desk Admin",
      email: DEMO_ACCOUNTS.admin.email,
      phone: "0917 000 0002",
      role: "admin",
      password: DEMO_ACCOUNTS.admin.password,
      createdAt: iso(subDays(now, 700)),
      createdBy: "u_owner",
    },
    {
      id: "u_guest",
      name: "Juan Dela Cruz",
      email: DEMO_ACCOUNTS.guest.email,
      phone: "0918 555 0123",
      role: "customer",
      password: DEMO_ACCOUNTS.guest.password,
      createdAt: iso(subDays(now, 75)),
    },
  ];
  for (let i = 0; i < 24; i++) {
    const first = FIRST[i];
    const last = LAST[(i * 7) % LAST.length];
    // Spread sign-ups over the past ~2 years, a few this month.
    const daysAgo = i >= 21 ? Math.floor(rand() * Math.min(now.getDate(), 18)) : Math.floor(740 - i * 31 - rand() * 10);
    users.push({
      id: `u_c${i + 1}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase().replace(/\s/g, "")}.${last.toLowerCase()}@mail.demo`,
      phone: `09${Math.floor(10 + rand() * 89)} ${Math.floor(100 + rand() * 899)} ${Math.floor(1000 + rand() * 8999)}`,
      role: "customer",
      password: "guest123",
      createdAt: iso(subDays(now, Math.max(0, daysAgo))),
    });
  }
  const customers = users.filter((u) => u.role === "customer" && u.id !== "u_guest");
  const recentCutoff = iso(subDays(now, 45));

  const methods: PaymentMethod[] = ["gcash", "gcash", "gcash", "gcash", "gcash", "maya", "maya", "maya", "bank", "bank"];
  const makeRef = (m: PaymentMethod) => {
    if (m === "gcash") return String(Math.floor(1e12 + rand() * 9e12));
    if (m === "maya") return Array.from({ length: 12 }, () => pick(CODE_CHARS.split(""))).join("");
    return `TRX${String(Math.floor(1e9 + rand() * 9e9))}`;
  };

  const bookings: Booking[] = [];
  const usedCodes = new Set<string>();
  const startKey = addDaysKey(today, -740);
  const horizon = 24;

  for (const room of rooms) {
    let cursor = startKey;
    while (cursor < addDaysKey(today, horizon)) {
      const d = new Date(cursor + "T00:00");
      const dow = d.getDay();
      const month = d.getMonth();
      let p = 0.42;
      if (dow === 5 || dow === 6) p += 0.25;
      if (month === 11 || month === 3 || month === 4) p += 0.15;
      if (room.id === "room-3") p -= 0.08;
      // Business has been growing: slightly busier in the last 4 months.
      if (cursor > addDaysKey(today, -120) && cursor <= today) p += 0.12;
      const ahead = cursor > today ? Math.floor((new Date(cursor + "T00:00").getTime() - now.getTime()) / 864e5) : 0;
      if (ahead > 0) p = Math.max(0.08, p - ahead * 0.025);
      if (rand() > p) {
        cursor = addDaysKey(cursor, 1);
        continue;
      }
      const r = rand();
      const len = r < 0.5 ? 1 : r < 0.8 ? 2 : r < 0.95 ? 3 : 5;
      const nights = Array.from({ length: len }, (_, i) => {
        const date = addDaysKey(cursor, i);
        return { roomId: room.id, date, rate: rateOf(room, date) };
      });
      const first = nights[0].date;
      const last = nights[nights.length - 1].date;
      const leadDays = Math.floor(rand() * 9);
      let created = addMinutes(subDays(new Date(first + "T00:00"), leadDays), 420 + Math.floor(rand() * 900));
      if (created > now) created = subDays(now, Math.floor(rand() * 3) + 1);
      const eligible = customers.filter((c) => c.createdAt <= iso(created) || c.createdAt < recentCutoff);
      const guest = eligible.length ? pick(eligible) : customers[0];
      const method = pick(methods);
      const total = nights.reduce((s, n) => s + n.rate, 0);

      let status: BookingStatus;
      if (last < today) {
        const x = rand();
        status = x < 0.04 ? "cancelled" : x < 0.06 ? "rejected" : "completed";
      } else if (first < today) status = "checked_in";
      else status = "confirmed";

      let code = makeBookingCode(rand);
      while (usedCodes.has(code)) code = makeBookingCode(rand);
      usedCodes.add(code);

      const paidAt = addMinutes(created, 3 + Math.floor(rand() * 10));
      const verifiedAt = addMinutes(paidAt, 15 + Math.floor(rand() * 90));
      const verifier = rand() < 0.7 ? "u_admin" : "u_owner";
      const history: Booking["history"] = [
        { at: iso(created), status: "hold", by: guest.id },
        { at: iso(paidAt), status: "pending_verification", by: guest.id },
      ];
      if (status === "rejected") history.push({ at: iso(verifiedAt), status, by: verifier, note: "Reference number not found in GCash history." });
      else {
        history.push({ at: iso(verifiedAt), status: "confirmed", by: verifier });
        if (status === "cancelled") history.push({ at: iso(addMinutes(verifiedAt, 600)), status, by: verifier, note: "Guest requested cancellation." });
      }
      const checkInAt = new Date(first + "T14:00");
      checkInAt.setMinutes(Math.floor(rand() * 240));
      if (status === "checked_in" || status === "completed") history.push({ at: iso(checkInAt), status: "checked_in", by: verifier });
      const checkOutAt = new Date(addDaysKey(last, 1) + "T11:00");
      if (status === "completed") history.push({ at: iso(checkOutAt), status: "completed", by: verifier });

      bookings.push({
        id: `b_${bookings.length + 1}`,
        code,
        userId: guest.id,
        guestName: guest.name,
        guestEmail: guest.email,
        guestPhone: guest.phone,
        nights,
        total,
        status,
        payment: { method, referenceNo: makeRef(method), amount: total, submittedAt: iso(paidAt) },
        verifiedBy: status === "rejected" ? undefined : verifier,
        verifiedAt: iso(verifiedAt),
        rejectReason: status === "rejected" ? "Reference number not found in GCash history." : undefined,
        checkedInAt: status === "checked_in" || status === "completed" ? iso(checkInAt) : undefined,
        checkedOutAt: status === "completed" ? iso(checkOutAt) : undefined,
        createdAt: iso(created),
        updatedAt: iso(verifiedAt),
        history,
      });
      cursor = addDaysKey(last, 1 + (rand() < 0.35 ? 1 : 0));
    }
  }

  // An account always exists before its first booking.
  for (const c of customers) {
    const first = bookings.filter((b) => b.userId === c.id).map((b) => b.createdAt).sort()[0];
    if (first && first < c.createdAt) c.createdAt = iso(subDays(new Date(first), 2));
  }

  // Two future bookings waiting for payment verification (with demo screenshots).
  const future = bookings.filter((b) => b.status === "confirmed" && b.nights[0].date > addDaysKey(today, 2));
  for (const b of future.slice(0, 2)) {
    b.status = "pending_verification";
    b.verifiedAt = undefined;
    b.verifiedBy = undefined;
    const submitted = subDays(now, 0);
    submitted.setMinutes(submitted.getMinutes() - 25 - Math.floor(rand() * 60));
    b.createdAt = iso(addMinutes(submitted, -6));
    b.history = b.history.slice(0, 2).map((h, i) => ({ ...h, at: iso(addMinutes(submitted, i ? 0 : -6)) }));
    b.payment = {
      ...b.payment!,
      submittedAt: iso(submitted),
      screenshot: makeDemoReceiptImage({
        method: b.payment!.method,
        amount: b.total,
        referenceNo: b.payment!.referenceNo,
        payer: b.guestName,
        when: submitted,
      }),
    };
    b.updatedAt = iso(submitted);
  }

  // Give the demo guest (Juan) a past stay and an upcoming confirmed stay.
  const juan = users.find((u) => u.id === "u_guest")!;
  const assign = (b: Booking | undefined) => {
    if (!b) return;
    b.userId = juan.id;
    b.guestName = juan.name;
    b.guestEmail = juan.email;
    b.guestPhone = juan.phone;
  };
  assign(
    bookings.find(
      (b) => b.status === "completed" && b.nights[0].date < addDaysKey(today, -30) && b.nights[0].date > addDaysKey(today, -60),
    ),
  );
  assign(
    bookings.find(
      (b) => b.status === "confirmed" && b.nights[0].date >= addDaysKey(today, 4) && b.nights[0].date <= addDaysKey(today, 14),
    ),
  );

  const emails: EmailMessage[] = [
    {
      id: "e_welcome",
      userId: juan.id,
      to: juan.email,
      subject: "Welcome to VV Apartelle Panabo",
      kind: "welcome",
      sentAt: juan.createdAt,
      read: true,
    },
  ];
  for (const b of bookings.filter((x) => x.userId === juan.id)) {
    emails.push({
      id: `e_${b.id}`,
      userId: juan.id,
      to: juan.email,
      subject: `Booking confirmed — ${b.code} (show this at the front desk)`,
      kind: "confirmed",
      bookingId: b.id,
      sentAt: b.verifiedAt ?? b.createdAt,
      read: b.status === "completed",
    });
  }

  const paymentChannels: PaymentChannel[] = [
    {
      id: "gcash",
      label: "GCash",
      accountName: "VV Apartelle Panabo",
      accountNumber: "0917 123 4567",
      instructions: "Open GCash → Pay QR → scan the code. Enter the exact amount.",
      enabled: true,
      qrImage: await makeQrDataUrl("DEMO ONLY | GCash | VV Apartelle Panabo | 09171234567"),
    },
    {
      id: "maya",
      label: "Maya",
      accountName: "VV Apartelle Panabo",
      accountNumber: "0998 765 4321",
      instructions: "Open Maya → Scan to pay → scan the code. Enter the exact amount.",
      enabled: true,
      qrImage: await makeQrDataUrl("DEMO ONLY | Maya | VV Apartelle Panabo | 09987654321"),
    },
    {
      id: "bank",
      label: "Bank transfer",
      accountName: "VV Apartelle Panabo",
      accountNumber: "0012 3456 7890",
      bankName: "BDO Unibank (demo)",
      instructions: "Scan with your bank app (InstaPay QR Ph) or transfer to the account below.",
      enabled: true,
      qrImage: await makeQrDataUrl("DEMO ONLY | QR Ph | VV Apartelle Panabo | 001234567890"),
    },
  ];

  return {
    version: DB_VERSION,
    seededAt: iso(now),
    users,
    rooms,
    rateOverrides,
    bookings,
    paymentChannels,
    emails,
    settings: {
      propertyName: "VV Apartelle Panabo",
      address: "Panabo City, Davao del Norte",
      contactPhone: "0917 123 4567",
      contactEmail: "bookings@vvapartelle.demo",
      holdMinutes: 15,
      checkInTime: "14:00",
      checkOutTime: "12:00",
      bookingWindowDays: 90,
    },
  };
}
