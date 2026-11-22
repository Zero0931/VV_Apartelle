import type { RateOverrides, Room } from "./types";

/** Effective nightly rate: a date override wins over the room's base rate. */
export function rateFor(room: Room, date: string, overrides: RateOverrides): number {
  return overrides[room.id]?.[date] ?? room.baseRate;
}

export function isOverridden(roomId: string, date: string, overrides: RateOverrides) {
  return overrides[roomId]?.[date] !== undefined;
}
