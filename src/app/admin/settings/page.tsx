"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import type { Settings } from "@/lib/types";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  return (
    <RequireRole roles={["owner"]}>
      <SettingsLoader />
    </RequireRole>
  );
}

function SettingsLoader() {
  const { data } = useQuery((s) => s.getSettings());
  if (!data) return <FullPageLoader />;
  return <SettingsForm key={JSON.stringify(data)} initial={data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (form.holdMinutes < 1 || form.holdMinutes > 120) return toast("Hold time must be 1–120 minutes.", "bad");
    if (form.bookingWindowDays < 7 || form.bookingWindowDays > 365) return toast("Booking window must be 7–365 days.", "bad");
    setBusy(true);
    try {
      await store.updateSettings(form);
      toast("Settings saved.");
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setResetting(true);
    await store.resetDemo();
    toast("Demo data has been reset.");
    setResetting(false);
    setConfirmReset(false);
    router.refresh();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Property" description="Shown on receipts, emails and the booking site." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Property name">
              <Input value={form.propertyName} onChange={(e) => set("propertyName", e.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <Field label="Contact number">
              <Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            </Field>
            <Field label="Contact / sender email">
              <Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Booking rules" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Payment hold time (minutes)" hint="How long selected rooms are held while the guest pays.">
              <Input
                type="number"
                min={1}
                max={120}
                value={form.holdMinutes}
                onChange={(e) => set("holdMinutes", Number(e.target.value))}
              />
            </Field>
            <Field label="Booking window (days ahead)" hint="How far in advance guests can book.">
              <Input
                type="number"
                min={7}
                max={365}
                value={form.bookingWindowDays}
                onChange={(e) => set("bookingWindowDays", Number(e.target.value))}
              />
            </Field>
            <Field label="Check-in time">
              <Input type="time" value={form.checkInTime} onChange={(e) => set("checkInTime", e.target.value)} />
            </Field>
            <Field label="Check-out time">
              <Input type="time" value={form.checkOutTime} onChange={(e) => set("checkOutTime", e.target.value)} />
            </Field>
          </div>
          <div className="border-t border-line px-5 py-3 text-right">
            <Button onClick={save} loading={busy}>
              Save settings
            </Button>
          </div>
        </Card>

        <Card className="border-bad/30">
          <CardHeader
            title="Reset demo data"
            description="Restores the original rooms, rates, sample bookings and accounts. Anything you added will be erased."
            action={
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="size-4" /> Reset
              </Button>
            }
          />
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all demo data?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reset} loading={resetting}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This only affects this browser.</p>
      </Modal>
    </div>
  );
}
