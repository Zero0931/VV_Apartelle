"use client";

import { nanoid } from "nanoid";
import { computeDashboard } from "../analytics";
import { addDaysKey, lastNight, todayKey } from "../format";
import { isOverridden, rateFor } from "../pricing";
import {
  ACTIVE_STATUSES,
  type Availability,
  type AvailabilityCell,
  type Booking,
  type BookingStatus,
  type DB,
  type EmailKind,
  type PaymentChannel,
  type PaymentMethod,
  type PublicUser,
  type Role,
  type Room,
  type User,
} from "../types";
import { createSeed, DB_VERSION, makeBookingCode } from "./seed";
import { StoreError, type BookingFilter, type DataStore, type RoomInput } from "./store";

const DB_KEY = "vv-apartelle-demo-db";
const SESSION_KEY = "vv-apartelle-session"; // sessionStorage: per-tab login
const LAST_SESSION_KEY = "vv-apartelle-last-session"; // localStorage: default for new tabs
const LOGGED_OUT_KEY = "vv-apartelle-logged-out"; // sessionStorage

const strip = ({ password: _pw, ...u }: User): PublicUser => u; // eslint-disable-line @typescript-eslint/no-unused-vars

const EMAIL_SUBJECT: Record<EmailKind, (code: string) => string> = {
  welcome: () => "Welcome to VV Apartelle Panabo",
  received: (c) => `Payment received — booking ${c} is being verified`,
  confirmed: (c) => `Booking confirmed — ${c} (show this at the front desk)`,
  rejected: (c) => `Payment could not be verified — ${c}`,
  cancelled: (c) => `Booking cancelled — ${c}`,
};

export class LocalStore implements DataStore {
  private db!: DB;
  private listeners = new Set<() => void>();
  private sessionUserId: string | null = null;
  private initPromise: Promise<void> | null = null;

  init() {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit() {
    const raw = localStorage.getItem(DB_KEY);
    let db: DB | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DB;
        if (parsed.version === DB_VERSION) db = parsed;
      } catch {
        db = null;
      }
    }
    if (!db) {
      db = await createSeed();
      this.write(db);
    }
    this.db = db;

    const tabSession = sessionStorage.getItem(SESSION_KEY);
    const loggedOut = sessionStorage.getItem(LOGGED_OUT_KEY) === "1";
    this.sessionUserId = tabSession ?? (loggedOut ? null : localStorage.getItem(LAST_SESSION_KEY));
    if (this.sessionUserId && !this.db.users.some((u) => u.id === this.sessionUserId)) this.sessionUserId = null;

    // Keep multiple tabs (e.g. guest + front desk) in sync live.
    window.addEventListener("storage", (e) => {
      if (e.key === DB_KEY && e.newValue) {
        try {
          this.db = JSON.parse(e.newValue);
          this.emit();
        } catch {
          /* ignore */
        }
      }
    });
    // Expire holds even when nobody is clicking.
    window.setInterval(() => {
      const db = this.fresh();
      if (this.sweep(db)) this.save(db);
    }, 5000);
    const db2 = this.fresh();
    if (this.sweep(db2)) this.save(db2);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------- internals

  private emit() {
    queueMicrotask(() => this.listeners.forEach((l) => l()));
  }

  /** Re-read from storage so writes are checked against other tabs' latest data. */
  private fresh(): DB {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as DB;
      } catch {
        /* fall through */
      }
    }
    return structuredClone(this.db);
  }

  private write(db: DB) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      throw new StoreError(
        "The demo's browser storage is full. Try a smaller image, or reset the demo data in Settings.",
      );
    }
  }

  private save(db: DB) {
    this.write(db);
    this.db = db;
    this.emit();
  }

  private mutate<T>(fn: (db: DB) => T): T {
    const db = this.fresh();
    this.sweep(db);
    const result = fn(db);
    this.save(db);
    return result;
  }

  /** Expires stale holds and completes past stays. Returns true if anything changed. */
  private sweep(db: DB) {
    const nowIso = new Date().toISOString();
    const yesterday = addDaysKey(todayKey(), -1);
    const pastCheckout = new Date().toTimeString().slice(0, 5) >= db.settings.checkOutTime;
    let changed = false;
    for (const b of db.bookings) {
      if (b.status === "hold" && b.holdExpiresAt && b.holdExpiresAt <= nowIso) {
        this.setStatus(b, "expired", undefined, "Hold timed out before payment was submitted.");
        changed = true;
      } else if (
        b.status === "checked_in" &&
        (lastNight(b.nights) < yesterday || (lastNight(b.nights) === yesterday && pastCheckout))
      ) {
        b.checkedOutAt = nowIso;
        this.setStatus(b, "completed", undefined, "Auto check-out after check-out time.");
        changed = true;
      }
    }
    return changed;
  }

  private setStatus(b: Booking, status: BookingStatus, by?: string, note?: string) {
    const at = new Date().toISOString();
    b.status = status;
    b.updatedAt = at;
    b.history.push({ at, status, by, note });
    if (status !== "hold") b.holdExpiresAt = undefined;
  }

  private sendEmail(db: DB, b: Booking, kind: EmailKind) {
    db.emails.push({
      id: nanoid(10),
      userId: b.userId,
      to: b.guestEmail,
      subject: EMAIL_SUBJECT[kind](b.code),
      kind,
      bookingId: b.id,
      sentAt: new Date().toISOString(),
      read: false,
    });
  }

  private me(db: DB = this.db): User {
    const u = db.users.find((x) => x.id === this.sessionUserId);
    if (!u) throw new StoreError("Please log in first.", "auth");
    return u;
  }

  private requireRole(roles: Role[], db: DB = this.db) {
    const u = this.me(db);
    if (!roles.includes(u.role)) throw new StoreError("You don't have permission to do that.", "forbidden");
    return u;
  }

  private findBooking(db: DB, id: string) {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new StoreError("Booking not found.", "not_found");
    return b;
  }

  private canSee(b: Booking) {
    const u = this.me();
    return u.role !== "customer" || b.userId === u.id;
  }

  private setSession(id: string | null) {
    this.sessionUserId = id;
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
      sessionStorage.removeItem(LOGGED_OUT_KEY);
      localStorage.setItem(LAST_SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(LOGGED_OUT_KEY, "1");
      localStorage.removeItem(LAST_SESSION_KEY);
    }
    this.emit();
  }

  // --------------------------------------------------------------------- auth

  async getCurrentUser() {
    const u = this.db.users.find((x) => x.id === this.sessionUserId);
    return u ? strip(u) : null;
  }

  async signIn(email: string, password: string) {
    const u = this.db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new StoreError("Incorrect email or password.", "auth");
    this.setSession(u.id);
    return strip(u);
  }

  async signUp(input: { name: string; email: string; phone: string; password: string }) {
    const user = this.mutate((db) => {
      const email = input.email.trim().toLowerCase();
      if (db.users.some((x) => x.email.toLowerCase() === email))
        throw new StoreError("An account with that email already exists.");
      const u: User = {
        id: `u_${nanoid(8)}`,
        name: input.name.trim(),
        email,
        phone: input.phone.trim(),
        role: "customer",
        password: input.password,
        createdAt: new Date().toISOString(),
      };
      db.users.push(u);
      db.emails.push({
        id: nanoid(10),
        userId: u.id,
        to: u.email,
        subject: EMAIL_SUBJECT.welcome(""),
        kind: "welcome",
        sentAt: u.createdAt,
        read: false,
      });
      return u;
    });
    this.setSession(user.id);
    return strip(user);
  }

  async signOut() {
    this.setSession(null);
  }

  // -------------------------------------------------------------------- users

  async listUsers(role?: Role) {
    this.requireRole(["owner", "admin"]);
    return this.db.users.filter((u) => !role || u.role === role).map(strip);
  }

  async createStaff(input: { name: string; email: string; phone: string; password: string }) {
    return this.mutate((db) => {
      const owner = this.requireRole(["owner"], db);
      const email = input.email.trim().toLowerCase();
      if (db.users.some((x) => x.email.toLowerCase() === email))
        throw new StoreError("An account with that email already exists.");
      const u: User = {
        id: `u_${nanoid(8)}`,
        name: input.name.trim(),
        email,
        phone: input.phone.trim(),
        role: "admin",
        password: input.password,
        createdAt: new Date().toISOString(),
        createdBy: owner.id,
      };
      db.users.push(u);
      return strip(u);
    });
  }

  async removeStaff(userId: string) {
    this.mutate((db) => {
      this.requireRole(["owner"], db);
      const u = db.users.find((x) => x.id === userId);
      if (!u || u.role !== "admin") throw new StoreError("Only admin accounts can be removed here.");
      db.users = db.users.filter((x) => x.id !== userId);
    });
  }

  // -------------------------------------------------------------------- rooms

  async listRooms(opts?: { includeArchived?: boolean }) {
    return this.db.rooms
      .filter((r) => opts?.includeArchived || !r.archived)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getRoom(id: string) {
    return this.db.rooms.find((r) => r.id === id) ?? null;
  }

  async createRoom(input: RoomInput) {
    return this.mutate((db) => {
      this.requireRole(["owner"], db);
      const room: Room = {
        ...input,
        id: `room-${nanoid(6)}`,
        active: true,
        archived: false,
        sortOrder: Math.max(0, ...db.rooms.map((r) => r.sortOrder)) + 1,
        createdAt: new Date().toISOString(),
      };
      db.rooms.push(room);
      return room;
    });
  }

  async updateRoom(id: string, patch: Partial<RoomInput> & { active?: boolean }) {
    return this.mutate((db) => {
      this.requireRole(["owner"], db);
      const room = db.rooms.find((r) => r.id === id);
      if (!room) throw new StoreError("Room not found.", "not_found");
      Object.assign(room, patch);
      return room;
    });
  }

  async removeRoom(id: string) {
    return this.mutate((db) => {
      this.requireRole(["owner"], db);
      const room = db.rooms.find((r) => r.id === id);
      if (!room) throw new StoreError("Room not found.", "not_found");
      const today = todayKey();
      const upcoming = db.bookings.filter(
        (b) => ACTIVE_STATUSES.includes(b.status) && b.nights.some((n) => n.roomId === id && n.date >= today),
      );
      if (upcoming.length)
        throw new StoreError(
          `${room.name} still has ${upcoming.length} upcoming booking(s). Cancel or move them first, or close the room instead.`,
          "conflict",
        );
      const hasHistory = db.bookings.some((b) => b.nights.some((n) => n.roomId === id));
      if (hasHistory) {
        room.archived = true;
        room.active = false;
        room.archivedAt = new Date().toISOString();
        return { mode: "archived" as const };
      }
      db.rooms = db.rooms.filter((r) => r.id !== id);
      delete db.rateOverrides[id];
      return { mode: "deleted" as const };
    });
  }

  async getRateOverrides() {
    return this.db.rateOverrides;
  }

  async setRateOverrides(roomIds: string[], dates: string[], rate: number | null) {
    this.mutate((db) => {
      this.requireRole(["owner"], db);
      if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) throw new StoreError("Enter a valid rate.");
      for (const roomId of roomIds) {
        const m = (db.rateOverrides[roomId] ??= {});
        for (const d of dates) {
          if (rate === null) delete m[d];
          else m[d] = Math.round(rate);
        }
      }
    });
  }

  // ------------------------------------------------------------ availability

  private occupancy(db: DB) {
    const map = new Map<string, Booking>(); // `${roomId}|${date}` -> booking
    for (const b of db.bookings) {
      if (!ACTIVE_STATUSES.includes(b.status)) continue;
      for (const n of b.nights) map.set(`${n.roomId}|${n.date}`, b);
    }
    return map;
  }

  async getAvailability(from: string, days: number): Promise<Availability> {
    const db = this.db;
    const today = todayKey();
    const dates = Array.from({ length: days }, (_, i) => addDaysKey(from, i));
    const rooms = db.rooms.filter((r) => !r.archived).sort((a, b) => a.sortOrder - b.sortOrder);
    const occ = this.occupancy(db);
    const now = new Date().toISOString();
    const cells: Availability["cells"] = {};
    for (const r of rooms) {
      cells[r.id] = {};
      for (const d of dates) {
        const b = occ.get(`${r.id}|${d}`);
        let status: AvailabilityCell["status"] = "available";
        if (d < today) status = "past";
        else if (!r.active) status = "closed";
        else if (b) {
          if (b.status === "hold" && b.holdExpiresAt && b.holdExpiresAt > now)
            status = b.userId === this.sessionUserId ? "my-hold" : "held";
          else if (b.status !== "hold") status = "booked";
        }
        cells[r.id][d] = {
          status,
          rate: rateFor(r, d, db.rateOverrides),
          overridden: isOverridden(r.id, d, db.rateOverrides),
        };
      }
    }
    return { dates, rooms, cells };
  }

  async createHold(nights: { roomId: string; date: string }[]) {
    return this.mutate((db) => {
      const user = this.me(db);
      if (!nights.length) throw new StoreError("Select at least one night.");
      const today = todayKey();
      const maxDate = addDaysKey(today, db.settings.bookingWindowDays);
      const unique = new Map(nights.map((n) => [`${n.roomId}|${n.date}`, n]));

      // A guest keeps only one hold at a time — starting over releases the old one.
      for (const b of db.bookings) {
        if (b.userId === user.id && b.status === "hold")
          this.setStatus(b, "expired", user.id, "Released — guest started a new reservation.");
      }

      const occ = this.occupancy(db);
      const items = [...unique.values()].map((n) => {
        const room = db.rooms.find((r) => r.id === n.roomId && !r.archived);
        if (!room || !room.active) throw new StoreError("One of the selected rooms is not available.");
        if (n.date < today || n.date > maxDate) throw new StoreError("One of the selected dates can't be booked.");
        if (occ.has(`${n.roomId}|${n.date}`))
          throw new StoreError(
            `Sorry — ${room.name} on ${n.date} was just reserved by another guest. Please pick different dates.`,
            "conflict",
          );
        return { roomId: n.roomId, date: n.date, rate: rateFor(room, n.date, db.rateOverrides) };
      });
      items.sort((a, b) => a.date.localeCompare(b.date) || a.roomId.localeCompare(b.roomId));

      let code = makeBookingCode();
      while (db.bookings.some((b) => b.code === code)) code = makeBookingCode();
      const now = new Date();
      const booking: Booking = {
        id: `b_${nanoid(10)}`,
        code,
        userId: user.id,
        guestName: user.name,
        guestEmail: user.email,
        guestPhone: user.phone,
        nights: items,
        total: items.reduce((s, n) => s + n.rate, 0),
        status: "hold",
        holdExpiresAt: new Date(now.getTime() + db.settings.holdMinutes * 60_000).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        history: [{ at: now.toISOString(), status: "hold", by: user.id }],
      };
      db.bookings.push(booking);
      return booking;
    });
  }

  async cancelHold(bookingId: string) {
    this.mutate((db) => {
      const user = this.me(db);
      const b = this.findBooking(db, bookingId);
      if (b.userId !== user.id) throw new StoreError("Not your booking.", "forbidden");
      if (b.status !== "hold") return;
      this.setStatus(b, "cancelled", user.id, "Guest cancelled before paying.");
    });
  }

  async submitPayment(
    bookingId: string,
    proof: { method: PaymentMethod; referenceNo: string; screenshot?: string },
  ) {
    return this.mutate((db) => {
      const user = this.me(db);
      const b = this.findBooking(db, bookingId);
      if (b.userId !== user.id) throw new StoreError("Not your booking.", "forbidden");
      if (b.status === "expired") throw new StoreError("Your hold expired before payment was submitted. Please reserve again.", "conflict");
      if (b.status !== "hold") throw new StoreError("Payment was already submitted for this booking.");
      const ref = proof.referenceNo.trim();
      if (ref.length < 6) throw new StoreError("Enter the reference number from your payment confirmation.");
      if (!proof.screenshot) throw new StoreError("Upload a screenshot of your payment confirmation.");
      b.payment = {
        method: proof.method,
        referenceNo: ref,
        screenshot: proof.screenshot,
        amount: b.total,
        submittedAt: new Date().toISOString(),
      };
      this.setStatus(b, "pending_verification", user.id);
      this.sendEmail(db, b, "received");
      return b;
    });
  }

  async getBooking(id: string) {
    const b = this.db.bookings.find((x) => x.id === id);
    if (!b || !this.canSee(b)) return null;
    return b;
  }

  async findBookingByCode(code: string) {
    this.requireRole(["owner", "admin"]);
    const c = code.trim().toUpperCase().replace(/^VV-?/, "");
    return this.db.bookings.find((b) => b.code === `VV-${c}`) ?? null;
  }

  async listBookings(filter?: BookingFilter) {
    const u = this.me();
    const userId = u.role === "customer" ? u.id : filter?.userId;
    return this.db.bookings
      .filter((b) => (!userId || b.userId === userId) && (!filter?.statuses || filter.statuses.includes(b.status)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private transition(id: string, from: BookingStatus[], to: BookingStatus, opts?: { note?: string; email?: EmailKind }) {
    return this.mutate((db) => {
      const actor = this.requireRole(["owner", "admin"], db);
      const b = this.findBooking(db, id);
      if (!from.includes(b.status)) throw new StoreError(`This booking is already ${b.status.replace("_", " ")}.`);
      if (to === "confirmed") {
        b.verifiedBy = actor.id;
        b.verifiedAt = new Date().toISOString();
      }
      if (to === "rejected") b.rejectReason = opts?.note;
      if (to === "checked_in") b.checkedInAt = new Date().toISOString();
      if (to === "completed") b.checkedOutAt = new Date().toISOString();
      this.setStatus(b, to, actor.id, opts?.note);
      if (opts?.email) this.sendEmail(db, b, opts.email);
      return b;
    });
  }

  async confirmBooking(id: string) {
    return this.transition(id, ["pending_verification"], "confirmed", { email: "confirmed" });
  }
  async rejectBooking(id: string, reason: string) {
    return this.transition(id, ["pending_verification"], "rejected", { note: reason, email: "rejected" });
  }
  async cancelBooking(id: string, reason: string) {
    return this.transition(id, ["pending_verification", "confirmed"], "cancelled", { note: reason, email: "cancelled" });
  }
  async checkIn(id: string) {
    return this.transition(id, ["confirmed"], "checked_in");
  }
  async checkOut(id: string) {
    return this.transition(id, ["checked_in"], "completed");
  }

  // ----------------------------------------------------------------- payments

  async listPaymentChannels() {
    return this.db.paymentChannels;
  }

  async updatePaymentChannel(id: PaymentMethod, patch: Partial<Omit<PaymentChannel, "id">>) {
    this.mutate((db) => {
      this.requireRole(["owner"], db);
      const ch = db.paymentChannels.find((c) => c.id === id);
      if (!ch) throw new StoreError("Payment channel not found.", "not_found");
      Object.assign(ch, patch);
    });
  }

  // -------------------------------------------------------------------- email

  async listEmails(userId?: string) {
    const u = this.me();
    const target = u.role === "customer" ? u.id : (userId ?? u.id);
    return this.db.emails.filter((e) => e.userId === target).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async markEmailRead(id: string) {
    const e = this.db.emails.find((x) => x.id === id);
    if (!e || e.read) return;
    this.mutate((db) => {
      const m = db.emails.find((x) => x.id === id);
      if (m) m.read = true;
    });
  }

  // ---------------------------------------------------------------- settings

  async getSettings() {
    return this.db.settings;
  }

  async updateSettings(patch: Partial<DB["settings"]>) {
    return this.mutate((db) => {
      this.requireRole(["owner"], db);
      Object.assign(db.settings, patch);
      return db.settings;
    });
  }

  async getDashboardStats() {
    this.requireRole(["owner"]);
    return computeDashboard(this.db.bookings, this.db.rooms, this.db.users.map(strip));
  }

  async resetDemo() {
    const db = await createSeed();
    this.save(db);
    if (this.sessionUserId && !db.users.some((u) => u.id === this.sessionUserId)) this.setSession(null);
  }
}
