import type { PublicUser } from "./types";

/** Where to send a user after login/sign-up. */
export function landingFor(user: PublicUser, next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return user.role === "customer" ? "/book" : "/admin";
}
