"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Copy, Landmark, Smartphone, Wallet } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import { cn, formatPeso, METHOD_LABEL } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { RequireRole } from "@/components/require-role";
import { HoldCountdown, useCountdown } from "@/components/hold-countdown";
import { StaySummary } from "@/components/stay-summary";
import { ImageUpload } from "@/components/image-upload";
import { DataImage } from "@/components/logo";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const METHOD_ICON = { gcash: Smartphone, maya: Wallet, bank: Landmark } as const;

export default function CheckoutPage() {
  return (
    <RequireRole>
      <Checkout />
    </RequireRole>
  );
}

function Checkout() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const { data, loading } = useQuery(async (s) => {
    const [booking, rooms, channels] = await Promise.all([
      s.getBooking(id),
      s.listRooms({ includeArchived: true }),
      s.listPaymentChannels(),
    ]);
    return { booking, rooms, channels: channels.filter((c) => c.enabled) };
  }, [id]);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [referenceNo, setReferenceNo] = useState("");
  const [screenshot, setScreenshot] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const countdown = useCountdown(data?.booking?.holdExpiresAt);
  const status = data?.booking?.status;
  const shouldRedirect = !!status && !["hold", "pending_verification", "expired", "cancelled"].includes(status);
  useEffect(() => {
    if (shouldRedirect) router.replace(`/bookings/${id}`);
  }, [shouldRedirect, id, router]);

  if ((loading && !data) || shouldRedirect) return <FullPageLoader />;
  const booking = data?.booking;
  if (!booking) {
    return (
      <EmptyState title="Booking not found" className="py-24">
        <LinkButton href="/book" className="mt-4">
          Back to availability
        </LinkButton>
      </EmptyState>
    );
  }

  if (booking.status === "pending_verification") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <h1 className="mt-4 font-display text-3xl font-semibold">Payment submitted!</h1>
        <p className="mt-2 text-muted">
          Booking <b className="text-ink">{booking.code}</b> is being verified. Your receipt will be emailed once
          confirmed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href={`/bookings/${booking.id}`}>View booking</LinkButton>
          <LinkButton href="/inbox" variant="secondary">
            Open inbox
          </LinkButton>
        </div>
      </div>
    );
  }

  if (booking.status !== "hold" || countdown.expired) {
    const expired = booking.status === "expired" || countdown.expired;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-12 text-warn" />
        <h1 className="mt-4 font-display text-2xl font-semibold">
          {expired ? "Your hold has expired" : "Reservation cancelled"}
        </h1>
        <p className="mt-2 text-muted">
          {expired
            ? "The nights were released. Pick your dates again."
            : "These nights have been released."}
        </p>
        <LinkButton href="/book" className="mt-6">
          Choose dates again
        </LinkButton>
      </div>
    );
  }

  const channels = data.channels;
  const active = channels.find((c) => c.id === (method ?? channels[0]?.id));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setBusy(true);
    try {
      await store.submitPayment(booking.id, { method: active.id, referenceNo, screenshot });
      toast("Payment submitted — we'll email you once it's verified.");
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      await store.cancelHold(booking.id);
      router.push("/book");
    } catch (err) {
      toast(errorMessage(err), "bad");
      setCancelling(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text.replace(/\s/g, ""));
    toast("Copied to clipboard");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            Reservation <span className="font-mono font-semibold text-ink">{booking.code}</span>
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Complete your payment</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          Nights held for
          <HoldCountdown expiresAt={booking.holdExpiresAt!} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">1. Scan the QR and pay the exact amount</h2>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist">
              {channels.map((c) => {
                const Icon = METHOD_ICON[c.id];
                const on = c.id === active?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setMethod(c.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition",
                      on ? "border-ink bg-ink text-white" : "border-line-strong hover:border-ink",
                    )}
                  >
                    <Icon className="size-4" /> {c.label}
                  </button>
                );
              })}
            </div>
            {active ? (
              <div className="mt-5 grid items-start gap-6 sm:grid-cols-[220px_1fr]">
                <div className="rounded-xl border border-line bg-white p-3 text-center">
                  {active.qrImage ? (
                    <DataImage src={active.qrImage} alt={`${active.label} QR code`} className="mx-auto w-full" />
                  ) : (
                    <p className="py-16 text-sm text-muted">QR not uploaded yet</p>
                  )}
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
                    {active.label} QR · Demo
                  </p>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted">Amount to pay</dt>
                    <dd className="text-3xl font-semibold tabular-nums">{formatPeso(booking.total)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Account name</dt>
                    <dd className="font-medium">{active.accountName}</dd>
                  </div>
                  {active.bankName && (
                    <div>
                      <dt className="text-muted">Bank</dt>
                      <dd className="font-medium">{active.bankName}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted">{active.id === "bank" ? "Account number" : "Mobile number"}</dt>
                    <dd className="flex items-center gap-2 font-mono font-medium">
                      {active.accountNumber}
                      <button type="button" onClick={() => copy(active.accountNumber)} aria-label="Copy number" className="text-muted hover:text-ink">
                        <Copy className="size-3.5" />
                      </button>
                    </dd>
                  </div>
                  {active.instructions && <p className="rounded-lg bg-paper p-3 text-xs text-muted">{active.instructions}</p>}
                </dl>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">No payment channels are enabled. Please contact the front desk.</p>
            )}
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-semibold">2. Tell us about your payment</h2>
            <Field
              label={`${active ? METHOD_LABEL[active.id] : ""} reference number`}
              hint="Found on your payment confirmation screen (e.g. 13-digit GCash Ref No.)."
            >
              <Input
                required
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. 1234 567 890123"
                inputMode="text"
                className="font-mono"
              />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Screenshot of your payment</p>
              <ImageUpload
                value={screenshot}
                onChange={setScreenshot}
                label="Upload payment screenshot"
                hint="PNG or JPG — we'll compress it automatically."
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Button variant="ghost" onClick={cancel} loading={cancelling}>
                Cancel reservation
              </Button>
              <Button type="submit" size="lg" loading={busy} disabled={!referenceNo.trim() || !screenshot || !active}>
                Submit payment
              </Button>
            </div>
          </Card>
        </form>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-semibold">Booking summary</h2>
            <p className="mt-0.5 text-xs text-muted">
              {booking.guestName} · {booking.guestEmail}
            </p>
            <div className="mt-4">
              <StaySummary nights={booking.nights} rooms={data.rooms} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm text-muted">Total</span>
              <span className="text-xl font-semibold tabular-nums">{formatPeso(booking.total)}</span>
            </div>
            <p className="mt-4 rounded-lg bg-paper p-3 text-xs text-muted">
              Need different dates?{" "}
              <Link href="/book" className="font-medium text-accent hover:underline">
                Change selection
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
