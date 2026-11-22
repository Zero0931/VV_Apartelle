import type {
  Availability,
  Booking,
  BookingStatus,
  EmailMessage,
  PaymentChannel,
  PaymentMethod,
  PublicUser,
  RateOverrides,
  Role,
  Room,
  Settings,
} from "../types";
import type { DashboardStats } from "../analytics";

/**
 * The single seam between the UI and persistence.
 *
 * Every method is async so the localStorage implementation (local-store.ts)
 * can be replaced by a Supabase-backed one (supabase-store.ts, future) without
 * touching any page. `subscribe` maps to Supabase Realtime later.
 */
export interface DataStore {
  init(): Promise<void>;
  subscribe(listener: () => void): () => void;

  // --- Auth -----------------------------------------------------------
  getCurrentUser(): Promise<PublicUser | null>;
  signIn(email: string, password: string): Promise<PublicUser>;
  signUp(input: { name: string; email: string; phone: string; password: string }): Promise<PublicUser>;
  signOut(): Promise<void>;

  // --- Users ----------------------------------------------------------
  listUsers(role?: Role): Promise<PublicUser[]>;
  createStaff(input: { name: string; email: string; phone: string; password: string }): Promise<PublicUser>;
  removeStaff(userId: string): Promise<void>;

  // --- Rooms & rates --------------------------------------------------
  listRooms(opts?: { includeArchived?: boolean }): Promise<Room[]>;
  getRoom(id: string): Promise<Room | null>;
  createRoom(input: RoomInput): Promise<Room>;
  updateRoom(id: string, patch: Partial<RoomInput> & { active?: boolean }): Promise<Room>;
  /** Hard-deletes a room with no bookings; otherwise archives it. */
  removeRoom(id: string): Promise<{ mode: "deleted" | "archived" }>;
  getRateOverrides(): Promise<RateOverrides>;
  /** rate = null clears the override for those dates. */
  setRateOverrides(roomIds: string[], dates: string[], rate: number | null): Promise<void>;

  // --- Availability & bookings -----------------------------------------
  getAvailability(from: string, days: number): Promise<Availability>;
  createHold(nights: { roomId: string; date: string }[]): Promise<Booking>;
  cancelHold(bookingId: string): Promise<void>;
  submitPayment(
    bookingId: string,
    proof: { method: PaymentMethod; referenceNo: string; screenshot?: string },
  ): Promise<Booking>;
  getBooking(id: string): Promise<Booking | null>;
  findBookingByCode(code: string): Promise<Booking | null>;
  listBookings(filter?: BookingFilter): Promise<Booking[]>;
  confirmBooking(id: string): Promise<Booking>;
  rejectBooking(id: string, reason: string): Promise<Booking>;
  cancelBooking(id: string, reason: string): Promise<Booking>;
  checkIn(id: string): Promise<Booking>;
  checkOut(id: string): Promise<Booking>;

  // --- Payments -------------------------------------------------------
  listPaymentChannels(): Promise<PaymentChannel[]>;
  updatePaymentChannel(id: PaymentMethod, patch: Partial<Omit<PaymentChannel, "id">>): Promise<void>;

  // --- Email (simulated inbox) -----------------------------------------
  listEmails(userId?: string): Promise<EmailMessage[]>;
  markEmailRead(id: string): Promise<void>;

  // --- Settings & analytics --------------------------------------------
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  getDashboardStats(): Promise<DashboardStats>;
  resetDemo(): Promise<void>;
}

export interface RoomInput {
  name: string;
  tagline: string;
  description: string;
  capacity: number;
  bedType: string;
  amenities: string[];
  baseRate: number;
  photo?: string;
}

export interface BookingFilter {
  userId?: string;
  statuses?: BookingStatus[];
}

export class StoreError extends Error {
  constructor(
    message: string,
    public code: "conflict" | "not_found" | "forbidden" | "invalid" | "auth" = "invalid",
  ) {
    super(message);
    this.name = "StoreError";
  }
}
