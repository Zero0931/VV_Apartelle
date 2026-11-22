"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Mail, Phone, ZoomIn } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { formatDateTime, formatPeso, METHOD_LABEL, STATUS_LABEL } from "@/lib/format";
import { BookingActions } from "@/components/booking-actions";
import { StaySummary } from "@/components/stay-summary";
import { DataImage } from "@/components/logo";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { FullPageLoader } from "@/components/ui/spinner";
import { HoldCountdown } from "@/components/hold-countdown";

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useQuery(async (s) => {
    const [booking, rooms, users] = await Promise.all([
      s.getBooking(id),
      s.listRooms({ includeArchived: true }),
      s.listUsers(),
    ]);
    return { booking, rooms, users };
  }, [id]);
  const [zoom, setZoom] = useState(false);

  if (loading && !data) return <FullPageLoader />;
  const b = data?.booking;
  if (!data || !b) return <EmptyState title="Booking not found" className="py-24" />;
  const nameOf = (uid?: string) => data.users.find((u) => u.id === uid)?.name ?? "System";
  const amountOk = b.payment && b.payment.amount === b.total;

  return (
    <div>
      <Link href="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All bookings
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold sm:text-3xl">{b.code}</h1>
        <StatusBadge status={b.status} />
        {b.status === "hold" && b.holdExpiresAt && <HoldCountdown expiresAt={b.holdExpiresAt} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Guest" />
            <div className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted">Name</p>
                <p className="font-medium">{b.guestName}</p>
              </div>
              <a href={`mailto:${b.guestEmail}`} className="hover:text-accent">
                <p className="text-xs text-muted">Email</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <Mail className="size-3.5" /> {b.guestEmail}
                </p>
              </a>
              <a href={`tel:${b.guestPhone.replace(/\s/g, "")}`} className="hover:text-accent">
                <p className="text-xs text-muted">Mobile</p>
                <p className="flex items-center gap-1.5 font-medium">
                  <Phone className="size-3.5" /> {b.guestPhone}
                </p>
              </a>
            </div>
          </Card>

          <Card>
            <CardHeader title="Stay" description={`${b.nights.length} room-night(s)`} />
            <div className="px-5 py-4">
              <StaySummary nights={b.nights} rooms={data.rooms} />
              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm text-muted">Total due</span>
                <span className="text-xl font-semibold">{formatPeso(b.total)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <ol className="space-y-4 px-5 py-4">
              {[...b.history].reverse().map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line-strong" />
                  <div>
                    <p>
                      <span className="font-medium">{STATUS_LABEL[h.status]}</span>
                      <span className="text-muted"> · {h.by ? nameOf(h.by) : "System"}</span>
                    </p>
                    {h.note && <p className="text-muted">{h.note}</p>}
                    <p className="text-xs text-subtle">{formatDateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader title="Payment proof" />
            <div className="space-y-4 px-5 py-4 text-sm">
              {b.payment ? (
                <>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-muted">Method</dt>
                      <dd className="font-medium">{METHOD_LABEL[b.payment.method]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Amount</dt>
                      <dd className="flex items-center gap-1 font-medium">
                        {formatPeso(b.payment.amount)}
                        {amountOk && <CheckCircle2 className="size-3.5 text-ok" aria-label="Matches total" />}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Reference no.</dt>
                      <dd className="font-mono text-base font-semibold">{b.payment.referenceNo}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-muted">Submitted</dt>
                      <dd>{formatDateTime(b.payment.submittedAt)}</dd>
                    </div>
                  </dl>
                  {b.payment.screenshot ? (
                    <button
                      onClick={() => setZoom(true)}
                      className="group relative block w-full overflow-hidden rounded-lg border border-line bg-paper"
                    >
                      <DataImage src={b.payment.screenshot} alt="Payment screenshot" className="mx-auto max-h-72" />
                      <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/30 group-hover:opacity-100">
                        <ZoomIn className="size-6" />
                      </span>
                    </button>
                  ) : (
                    <p className="rounded-lg bg-paper p-3 text-xs text-muted">No screenshot on file (historical demo record).</p>
                  )}
                  {b.status === "pending_verification" && (
                    <p className="rounded-lg bg-info-soft p-3 text-xs text-info">
                      Check your {METHOD_LABEL[b.payment.method]} / bank app for a {formatPeso(b.total)} payment with
                      this reference number before confirming.
                    </p>
                  )}
                  {b.verifiedAt && b.verifiedBy && (
                    <p className="text-xs text-muted">
                      Verified by {nameOf(b.verifiedBy)} · {formatDateTime(b.verifiedAt)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted">The guest hasn&apos;t submitted payment yet.</p>
              )}
            </div>
          </Card>
          {["pending_verification", "confirmed", "checked_in"].includes(b.status) && (
            <Card className="p-5">
              <BookingActions booking={b} />
            </Card>
          )}
        </div>
      </div>

      {b.payment?.screenshot && (
        <Modal open={zoom} onClose={() => setZoom(false)} title={`Payment screenshot · ${b.code}`} size="lg">
          <DataImage src={b.payment.screenshot} alt="Payment screenshot" className="mx-auto max-h-[75vh]" />
        </Modal>
      )}
    </div>
  );
}
