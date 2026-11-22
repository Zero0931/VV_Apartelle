"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConciergeBell, Crown, User } from "lucide-react";
import { useAuth } from "@/lib/data/provider";
import { DEMO_ACCOUNTS } from "@/lib/data/seed";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/card";
import { errorMessage } from "@/components/ui/toast";
import { landingFor } from "@/lib/routes";


const QUICK = [
  { key: "guest", label: "Guest", desc: "Juan Dela Cruz — book & pay", icon: User },
  { key: "admin", label: "Front desk admin", desc: "Verify payments, check-in", icon: ConciergeBell },
  { key: "owner", label: "Owner", desc: "Dashboard, rooms, rates, staff", icon: Crown },
] as const;

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const doLogin = async (e: string, p: string, key: string) => {
    setBusy(key);
    setError("");
    try {
      const u = await signIn(e, p);
      router.replace(landingFor(u, next));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    doLogin(email, password, "form");
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Log in</h1>
        <p className="mt-1 text-sm text-muted">
          New here?{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Alert tone="bad">{error}</Alert>}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full" size="lg" loading={busy === "form"}>
            Log in
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-dashed border-line-strong p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Demo shortcuts</p>
        <h2 className="mt-2 text-lg font-semibold">Try each role in one click</h2>
        <p className="mt-1 text-sm text-muted">
          Each tab keeps its own login.
        </p>
        <div className="mt-5 space-y-3">
          {QUICK.map((q) => {
            const acc = DEMO_ACCOUNTS[q.key];
            return (
              <button
                key={q.key}
                onClick={() => doLogin(acc.email, acc.password, q.key)}
                disabled={!!busy}
                className="flex w-full items-center gap-4 rounded-xl border border-line bg-surface p-4 text-left transition hover:border-ink disabled:opacity-60"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-paper">
                  <q.icon className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-medium">{q.label}</span>
                  <span className="block text-xs text-muted">{q.desc}</span>
                </span>
                <span className="hidden text-right font-mono text-[11px] text-subtle sm:block">
                  {acc.email}
                  <br />
                  {acc.password}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
