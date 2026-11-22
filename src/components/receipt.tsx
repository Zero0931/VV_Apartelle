"use client";

import { useEffect, useState } from "react";
import { makeQrDataUrl } from "@/lib/images";
import {
  firstNight,
  formatDate,
  formatDateTime,
  formatPeso,
  formatTime12,
  addDaysKey,
  lastNight,
  METHOD_LABEL,
} from "@/lib/format";
import type { Booking, Room, Settings } from "@/lib/types";
import { DataImage } from "./logo";
import { StaySummary } from "./stay-summary";
import { StatusBadge } from "./ui/status-badge";
import Image from "next/image";

export function BookingQr({ code, size = 140 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    makeQrDataUrl(code, size * 2).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [code, size]);
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      {src && <DataImage src={src} alt={`QR code for booking ${code}`} className="size-full" />}
    </div>
  );
}

export function Receipt({ booking, rooms, settings }: { booking: Booking; rooms: Room[]; settings: Settings }) {
  const checkIn = firstNight(booking.nights);
  const checkOut = addDaysKey(lastNight(booking.nights), 1);
  return (
    <div className="print-plain overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-line-strong px-6 py-5">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="" width={48} height={48} className="size-12 mix-blend-multiply" />
          <div>
            <p className="font-display text-lg font-semibold leading-tight">{settings.propertyName}</p>
            <p className="text-xs text-muted">{settings.address}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Booking receipt</p>
          <StatusBadge status={booking.status} className="mt-1" />
        </div>
      </div>

      <div className="grid gap-6 px-6 py-5 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted">Booking code</p>
            <p className="font-mono text-3xl font-bold tracking-wider">{booking.code}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Guest</dt>
              <dd className="font-medium">{booking.guestName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Mobile</dt>
              <dd className="font-medium">{booking.guestPhone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Check-in</dt>
              <dd className="font-medium">
                {formatDate(checkIn, "EEE, MMM d, yyyy")}
                <span className="block text-xs font-normal text-muted">from {formatTime12(settings.checkInTime)}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Check-out</dt>
              <dd className="font-medium">
                {formatDate(checkOut, "EEE, MMM d, yyyy")}
                <span className="block text-xs font-normal text-muted">until {formatTime12(settings.checkOutTime)}</span>
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col items-center gap-1">
          <BookingQr code={booking.code} />
          <p className="text-[11px] text-muted">Show at the front desk</p>
        </div>
      </div>

      <div className="border-t border-line px-6 py-5">
        <StaySummary nights={booking.nights} rooms={rooms} />
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="font-medium">Total paid</span>
          <span className="text-2xl font-semibold tabular-nums">{formatPeso(booking.total)}</span>
        </div>
      </div>

      {booking.payment && (
        <div className="grid gap-3 border-t border-line bg-paper/60 px-6 py-4 text-xs text-muted sm:grid-cols-3">
          <p>
            Paid via <b className="text-ink">{METHOD_LABEL[booking.payment.method]}</b>
          </p>
          <p>
            Ref. no. <b className="font-mono text-ink">{booking.payment.referenceNo}</b>
          </p>
          <p>{booking.verifiedAt ? `Verified ${formatDateTime(booking.verifiedAt)}` : "Awaiting verification"}</p>
        </div>
      )}
      <p className="border-t border-line px-6 py-3 text-[11px] text-subtle">
        Please present this receipt (printed or on your phone) together with a valid ID upon arrival. For changes,
        contact {settings.contactPhone}.
      </p>
    </div>
  );
}
