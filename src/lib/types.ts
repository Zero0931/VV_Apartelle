// Core domain types for VV Apartelle Panabo.
// These map 1:1 to the tables drafted in supabase/schema.sql so the
// localStorage demo store can later be swapped for Supabase.

export type Role = "customer" | "admin" | "owner";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** DEMO ONLY: plaintext password. Supabase Auth replaces this. */
  password: string;
  createdAt: string; // ISO
  createdBy?: string;
}

export type PublicUser = Omit<User, "password">;

export interface Room {
  id: string;
  name: string;
  tagline: string;
  description: string;
  capacity: number;
  bedType: string;
  amenities: string[];
  baseRate: number; // PHP per night
  photo?: string; // data URL or /public path
  /** Bookable right now (owner can close a room temporarily). */
  active: boolean;
  /** Removed from the property; kept only for historical bookings. */
  archived: boolean;
  archivedAt?: string;
  sortOrder: number;
  createdAt: string;
}

/** roomId -> (yyyy-MM-dd -> rate) */
export type RateOverrides = Record<string, Record<string, number>>;

export type BookingStatus =
  | "hold"
  | "pending_verification"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "expired"
  | "rejected"
  | "cancelled";

/** One room for one night. `date` is the night's check-in date (yyyy-MM-dd). */
export interface BookingNight {
  roomId: string;
  date: string;
  rate: number;
}

export type PaymentMethod = "gcash" | "maya" | "bank";

export interface PaymentProof {
  method: PaymentMethod;
  referenceNo: string;
  screenshot?: string; // compressed data URL
  amount: number;
  submittedAt: string;
}

export interface BookingEvent {
  at: string;
  status: BookingStatus;
  by?: string; // user id
  note?: string;
}

export interface Booking {
  id: string;
  code: string;
  userId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  nights: BookingNight[];
  total: number;
  status: BookingStatus;
  holdExpiresAt?: string;
  payment?: PaymentProof;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectReason?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  createdAt: string;
  updatedAt: string;
  history: BookingEvent[];
}

export interface PaymentChannel {
  id: PaymentMethod;
  label: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
  qrImage?: string; // data URL
  instructions?: string;
  enabled: boolean;
}

export type EmailKind = "welcome" | "received" | "confirmed" | "rejected" | "cancelled";

export interface EmailMessage {
  id: string;
  userId: string;
  to: string;
  subject: string;
  kind: EmailKind;
  bookingId?: string;
  sentAt: string;
  read: boolean;
}

export interface Settings {
  propertyName: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  holdMinutes: number;
  checkInTime: string; // HH:mm
  checkOutTime: string; // HH:mm
  bookingWindowDays: number;
}

export interface DB {
  version: number;
  seededAt: string;
  users: User[];
  rooms: Room[];
  rateOverrides: RateOverrides;
  bookings: Booking[];
  paymentChannels: PaymentChannel[];
  emails: EmailMessage[];
  settings: Settings;
}

/** Status of a single room-night cell in the availability grid. */
export type CellStatus = "available" | "held" | "my-hold" | "booked" | "closed" | "past";

export interface AvailabilityCell {
  status: CellStatus;
  rate: number;
  overridden: boolean;
}

export interface Availability {
  dates: string[];
  rooms: Room[];
  cells: Record<string, Record<string, AvailabilityCell>>;
}

export const ACTIVE_STATUSES: BookingStatus[] = [
  "hold",
  "pending_verification",
  "confirmed",
  "checked_in",
];

export const PAID_STATUSES: BookingStatus[] = ["confirmed", "checked_in", "completed"];
