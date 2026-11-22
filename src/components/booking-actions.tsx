"use client";

import { useState } from "react";
import { Ban, CheckCircle2, DoorOpen, LogOut, XCircle } from "lucide-react";
import { useStore } from "@/lib/data/provider";
import { firstNight, formatDate, todayKey } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { Button } from "./ui/button";
import { Field, Textarea } from "./ui/form";
import { Modal } from "./ui/modal";
import { errorMessage, useToast } from "./ui/toast";

const REJECT_PRESETS = [
  "Reference number not found in our transaction history.",
  "Amount received does not match the booking total.",
  "Screenshot is unclear or incomplete.",
];
const CANCEL_PRESETS = ["Guest requested cancellation.", "No-show.", "Duplicate booking."];

export function BookingActions({ booking, layout = "stack" }: { booking: Booking; layout?: "stack" | "row" }) {
  const store = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "reject" | "cancel">(null);
  const [reason, setReason] = useState("");

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast(msg);
      setModal(null);
      setReason("");
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(null);
    }
  };

  const arrival = firstNight(booking.nights);
  const early = arrival > todayKey();
  const cls = layout === "stack" ? "flex flex-col gap-2" : "flex flex-wrap gap-2";

  return (
    <>
      <div className={cls}>
        {booking.status === "pending_verification" && (
          <>
            <Button
              variant="primary"
              size="lg"
              loading={busy === "confirm"}
              onClick={() => run("confirm", () => store.confirmBooking(booking.id), `Confirmed ${booking.code} — receipt emailed to the guest.`)}
            >
              <CheckCircle2 className="size-4" /> Confirm payment
            </Button>
            <Button variant="secondary" onClick={() => setModal("reject")}>
              <XCircle className="size-4" /> Reject payment
            </Button>
          </>
        )}
        {booking.status === "confirmed" && (
          <>
            <Button
              size="lg"
              loading={busy === "checkin"}
              onClick={() => run("checkin", () => store.checkIn(booking.id), `${booking.guestName} checked in.`)}
            >
              <DoorOpen className="size-4" /> Check in guest
            </Button>
            {early && (
              <p className="text-xs text-warn">Arrival is on {formatDate(arrival, "EEE, MMM d")} — early check-in?</p>
            )}
            <Button variant="secondary" onClick={() => setModal("cancel")}>
              <Ban className="size-4" /> Cancel booking
            </Button>
          </>
        )}
        {booking.status === "checked_in" && (
          <Button
            size="lg"
            loading={busy === "checkout"}
            onClick={() => run("checkout", () => store.checkOut(booking.id), `${booking.guestName} checked out.`)}
          >
            <LogOut className="size-4" /> Check out
          </Button>
        )}
      </div>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "reject" ? `Reject payment for ${booking.code}` : `Cancel ${booking.code}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={busy === modal}
              onClick={() =>
                modal === "reject"
                  ? run("reject", () => store.rejectBooking(booking.id, reason.trim()), "Payment rejected — the guest was notified.")
                  : run("cancel", () => store.cancelBooking(booking.id, reason.trim()), "Booking cancelled — the guest was notified.")
              }
            >
              {modal === "reject" ? "Reject & release nights" : "Cancel booking"}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          The guest will receive an email with this reason, and the nights become available again.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(modal === "reject" ? REJECT_PRESETS : CANCEL_PRESETS).map((p) => (
            <button
              key={p}
              onClick={() => setReason(p)}
              className="rounded-full border border-line-strong px-2.5 py-1 text-xs hover:border-ink"
            >
              {p}
            </button>
          ))}
        </div>
        <Field label="Reason">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
