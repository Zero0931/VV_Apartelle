"use client";

import Link from "next/link";
import { formatDateTime, formatPeso, METHOD_LABEL } from "@/lib/format";
import type { Booking, EmailMessage, Room, Settings } from "@/lib/types";
import { Receipt } from "./receipt";
import { StaySummary } from "./stay-summary";

export function EmailView({
  email,
  booking,
  rooms,
  settings,
}: {
  email: EmailMessage;
  booking?: Booking | null;
  rooms: Room[];
  settings: Settings;
}) {
  const first = booking?.guestName.split(" ")[0] ?? "there";
  return (
    <article className="flex h-full flex-col">
      <header className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-lg font-semibold leading-snug">{email.subject}</h2>
        <div className="mt-2 text-xs text-muted">
          <p>
            <span className="text-ink">From:</span> {settings.propertyName} &lt;{settings.contactEmail}&gt;
          </p>
          <p>
            <span className="text-ink">To:</span> {email.to}
          </p>
          <p>{formatDateTime(email.sentAt)}</p>
        </div>
      </header>
      <div className="space-y-4 px-5 py-5 text-sm leading-relaxed sm:px-6">
        {email.kind === "welcome" && (
          <>
            <p>Hi {first === "there" ? "there" : first},</p>
            <p>
              Welcome to {settings.propertyName}! Your account is ready. You can now check live room availability and
              book your stay any time — pay per night, no deposit needed.
            </p>
            <p>
              <Link href="/book" className="font-medium text-accent underline">
                Check availability →
              </Link>
            </p>
          </>
        )}

        {email.kind === "received" && booking && (
          <>
            <p>Hi {first},</p>
            <p>
              Thanks! We received your payment details for booking <b>{booking.code}</b> (
              {formatPeso(booking.total)} via {booking.payment ? METHOD_LABEL[booking.payment.method] : ""}, ref. {booking.payment?.referenceNo}
              ). Our front desk is verifying it now — your nights are reserved in the meantime.
            </p>
            <div className="rounded-lg border border-line p-4">
              <StaySummary nights={booking.nights} rooms={rooms} compact />
            </div>
            <p>You&apos;ll receive your official receipt in another email once your payment is confirmed.</p>
          </>
        )}

        {email.kind === "confirmed" && booking && (
          <>
            <p>Hi {first},</p>
            <p>
              Your booking is <b>confirmed</b>. Please show this receipt (printed or on your phone) at the front desk
              when you arrive.
            </p>
            <Receipt booking={booking} rooms={rooms} settings={settings} />
          </>
        )}

        {email.kind === "rejected" && booking && (
          <>
            <p>Hi {first},</p>
            <p>
              Unfortunately we couldn&apos;t verify your payment for booking <b>{booking.code}</b>
              {booking.rejectReason ? <> — reason: &ldquo;{booking.rejectReason}&rdquo;</> : null}. The nights have
              been released.
            </p>
            <p>
              If you already paid, please reply to this email or call {settings.contactPhone} with your payment
              screenshot and we&apos;ll sort it out.
            </p>
          </>
        )}

        {email.kind === "cancelled" && booking && (
          <>
            <p>Hi {first},</p>
            <p>
              Your booking <b>{booking.code}</b> has been cancelled
              {booking.history.at(-1)?.note ? <> (&ldquo;{booking.history.at(-1)?.note}&rdquo;)</> : null}. For refunds
              or questions, please contact us at {settings.contactPhone}.
            </p>
          </>
        )}

        {!booking && email.kind !== "welcome" && <p className="text-muted">This booking is no longer available.</p>}

        <p className="pt-2 text-muted">
          — {settings.propertyName}
          <br />
          {settings.address} · {settings.contactPhone}
        </p>
      </div>
    </article>
  );
}
