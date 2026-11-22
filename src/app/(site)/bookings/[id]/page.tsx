"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, Printer, XCircle } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { formatDateTime, formatPeso } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { Receipt } from "@/components/receipt";
import { StaySummary } from "@/components/stay-summary";
import { Button, LinkButton } from "@/components/ui/button";
import { Alert, Card, EmptyState } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FullPageLoader } from "@/components/ui/spinner";

export default function BookingDetailPage() {
  return (
    <RequireRole>
      <BookingDetail />
    </RequireRole>
  );
}

function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useQuery(async (s) => {
    const [booking, rooms, settings] = await Promise.all([
      s.getBooking(id),
      s.listRooms({ includeArchived: true }),
      s.getSettings(),
    ]);
    return { booking, rooms, settings };
  }, [id]);

  if (loading && !data) return <FullPageLoader />;
  const b = data?.booking;
  if (!data || !b) {
    return (
      <EmptyState title="Booking not found" className="py-24">
        <LinkButton href="/bookings" className="mt-4">
          My bookings
        </LinkButton>
      </EmptyState>
    );
  }
  const hasReceipt = ["confirmed", "checked_in", "completed"].includes(b.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/bookings" className="flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> My bookings
        </Link>
        {hasReceipt && (
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
        )}
      </div>

      {hasReceipt ? (
        <Receipt booking={b} rooms={data.rooms} settings={data.settings} />
      ) : (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Booking code</p>
              <p className="font-mono text-2xl font-bold">{b.code}</p>
            </div>
            <StatusBadge status={b.status} />
          </div>
          {b.status === "pending_verification" && (
            <Alert tone="info" className="mt-5 flex gap-2">
              <Clock className="mt-0.5 size-4 shrink-0" />
              <span>
                Payment received {formatDateTime(b.payment!.submittedAt)}. Verifying now — receipt follows by email.
              </span>
            </Alert>
          )}
          {(b.status === "rejected" || b.status === "cancelled") && (
            <Alert tone="bad" className="mt-5 flex gap-2">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {b.status === "rejected" ? "We couldn't verify your payment." : "This booking was cancelled."}
                {(b.rejectReason || b.history.at(-1)?.note) && <> Reason: {b.rejectReason ?? b.history.at(-1)?.note}</>}{" "}
                Questions? Call {data.settings.contactPhone}.
              </span>
            </Alert>
          )}
          {b.status === "expired" && (
            <Alert tone="warn" className="mt-5">
              Hold expired before payment.
            </Alert>
          )}
          <div className="mt-6">
            <StaySummary nights={b.nights} rooms={data.rooms} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="text-sm text-muted">Total</span>
            <span className="text-xl font-semibold">{formatPeso(b.total)}</span>
          </div>
          {b.status === "hold" && (
            <LinkButton href={`/checkout/${b.id}`} className="mt-5 w-full">
              Continue to payment
            </LinkButton>
          )}
        </Card>
      )}
    </div>
  );
}
