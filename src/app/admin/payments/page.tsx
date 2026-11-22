"use client";

import { useState } from "react";
import { Landmark, Smartphone, Wallet } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import type { PaymentChannel } from "@/lib/types";
import { RequireRole } from "@/components/require-role";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Alert, Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Textarea, Toggle } from "@/components/ui/form";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const ICON = { gcash: Smartphone, maya: Wallet, bank: Landmark } as const;

export default function PaymentsPage() {
  return (
    <RequireRole roles={["owner"]}>
      <Payments />
    </RequireRole>
  );
}

function Payments() {
  const { data } = useQuery((s) => s.listPaymentChannels());
  if (!data) return <FullPageLoader />;
  return (
    <div>
      <PageHeader
        title="Payment QR codes"
        description="Upload the QR codes guests scan at checkout. Turn a channel off to hide it from guests."
      />
      <Alert tone="info" className="mb-6">
        Tip: in GCash go to <b>Profile → My QR → Download</b>; in Maya use <b>Receive money → Save QR</b>. For banks, use
        your InstaPay / QR Ph code. The demo QR codes below are placeholders.
      </Alert>
      <div className="grid gap-6 lg:grid-cols-3">
        {data.map((c) => (
          <ChannelCard key={c.id} channel={c} />
        ))}
      </div>
    </div>
  );
}

function ChannelCard({ channel }: { channel: PaymentChannel }) {
  const store = useStore();
  const toast = useToast();
  const [form, setForm] = useState(channel);
  const [busy, setBusy] = useState(false);
  const Icon = ICON[channel.id];
  const dirty = JSON.stringify(form) !== JSON.stringify(channel);

  const save = async (patch: Partial<PaymentChannel> = form) => {
    setBusy(true);
    try {
      await store.updatePaymentChannel(channel.id, patch);
      toast(`${channel.label} settings saved.`);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icon className="size-4" /> {channel.label}
        </h2>
        <Toggle
          checked={form.enabled}
          label={`${channel.label} enabled`}
          onChange={(enabled) => {
            setForm((f) => ({ ...f, enabled }));
            save({ enabled });
          }}
        />
      </div>
      <div className="flex-1 space-y-4 p-5">
        <ImageUpload
          value={form.qrImage}
          onChange={(qrImage) => setForm((f) => ({ ...f, qrImage }))}
          label="Upload QR code"
          maxDim={700}
          previewClassName="w-44"
        />
        <Field label="Account name">
          <Input value={form.accountName} onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))} />
        </Field>
        {channel.id === "bank" && (
          <Field label="Bank">
            <Input value={form.bankName ?? ""} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          </Field>
        )}
        <Field label={channel.id === "bank" ? "Account number" : "Mobile number"}>
          <Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
        </Field>
        <Field label="Instructions for guests">
          <Textarea
            rows={2}
            value={form.instructions ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
          />
        </Field>
      </div>
      <div className="border-t border-line px-5 py-3 text-right">
        <Button onClick={() => save()} disabled={!dirty} loading={busy}>
          Save
        </Button>
      </div>
    </Card>
  );
}
