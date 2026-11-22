"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/data/provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { errorMessage } from "@/components/ui/toast";
import { landingFor } from "@/lib/routes";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/, "Enter a PH mobile number, e.g. 0917 123 4567"),
  password: z.string().min(6, "At least 6 characters"),
});

type Errors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export default function RegisterPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Errors = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof Errors] ??= issue.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    setError("");
    try {
      const u = await signUp(parsed.data);
      router.replace(landingFor(u, next));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">
          Already have one?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Full name" error={errors.name}>
            <Input value={form.name} onChange={set("name")} autoComplete="name" />
          </Field>
          <Field label="Email" error={errors.email} hint="Your booking confirmation will be sent here.">
            <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
          </Field>
          <Field label="Mobile number" error={errors.phone}>
            <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="0917 123 4567" autoComplete="tel" />
          </Field>
          <Field label="Password" error={errors.password}>
            <Input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Create account
          </Button>
          <p className="text-center text-xs text-muted">Demo only — please don&apos;t use a real password.</p>
        </form>
      </div>
    </div>
  );
}
