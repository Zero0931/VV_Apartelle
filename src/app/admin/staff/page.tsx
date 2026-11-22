"use client";

import { useState } from "react";
import { Check, Crown, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { z } from "zod";
import { useQuery, useStore } from "@/lib/data/provider";
import { formatDate } from "@/lib/format";
import type { PublicUser } from "@/lib/types";
import { RequireRole } from "@/components/require-role";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const PERMISSIONS: [string, boolean, boolean][] = [
  ["View & search all bookings", true, true],
  ["Verify / reject payments", true, true],
  ["Check guests in and out", true, true],
  ["Cancel bookings", true, true],
  ["Revenue & occupancy dashboard", true, false],
  ["Add / remove rooms, set rates", true, false],
  ["Manage payment QR codes", true, false],
  ["Add / remove admins", true, false],
];

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone number"),
  password: z.string().min(6, "At least 6 characters"),
});

export default function StaffPage() {
  return (
    <RequireRole roles={["owner"]}>
      <Staff />
    </RequireRole>
  );
}

function Staff() {
  const store = useStore();
  const toast = useToast();
  const { data } = useQuery(async (s) => {
    const all = await s.listUsers();
    return all.filter((u) => u.role !== "customer");
  });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PublicUser | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <FullPageLoader />;

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await store.removeStaff(removing.id);
      toast(`${removing.name} no longer has admin access.`);
      setRemoving(null);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Delegate a front desk admin to check and confirm bookings on your behalf."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add admin
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="divide-y divide-line self-start">
          {data.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-4">
              <span className="flex size-10 items-center justify-center rounded-full bg-paper">
                {u.role === "owner" ? <Crown className="size-5 text-accent" /> : <ShieldCheck className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.name}</p>
                <p className="truncate text-sm text-muted">
                  {u.email} · {u.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{u.role === "owner" ? "Owner" : "Front desk admin"}</p>
                <p className="text-xs text-muted">Since {formatDate(u.createdAt.slice(0, 10), "MMM yyyy")}</p>
              </div>
              {u.role === "admin" && (
                <Button variant="ghost" size="sm" onClick={() => setRemoving(u)} aria-label={`Remove ${u.name}`}>
                  <Trash2 className="size-4 text-bad" />
                </Button>
              )}
            </div>
          ))}
        </Card>

        <Card className="self-start">
          <CardHeader title="What each role can do" />
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-5 py-2 text-left font-medium" />
                <th className="px-2 py-2 font-medium">Owner</th>
                <th className="px-2 py-2 pr-5 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PERMISSIONS.map(([label, o, a]) => (
                <tr key={label}>
                  <td className="px-5 py-2">{label}</td>
                  <td className="px-2 text-center">{o ? <Check className="mx-auto size-4 text-ok" /> : <Minus className="mx-auto size-4 text-subtle" />}</td>
                  <td className="px-2 pr-5 text-center">{a ? <Check className="mx-auto size-4 text-ok" /> : <Minus className="mx-auto size-4 text-subtle" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {adding && <AddAdmin onClose={() => setAdding(false)} />}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={busy}>
              Remove access
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">They will no longer be able to log in to the admin area.</p>
      </Modal>
    </div>
  );
}

function AddAdmin({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({});
    setBusy(true);
    try {
      await store.createStaff(parsed.data);
      toast(`${parsed.data.name} can now log in as admin.`);
      onClose();
    } catch (e) {
      toast(errorMessage(e), "bad");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a front desk admin"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Create admin
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Full name" error={errors.name}>
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Email (login)" error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Mobile number" error={errors.phone}>
          <Input value={form.phone} onChange={set("phone")} />
        </Field>
        <Field label="Temporary password" error={errors.password} hint="Share it with them privately.">
          <Input value={form.password} onChange={set("password")} />
        </Field>
      </div>
    </Modal>
  );
}
