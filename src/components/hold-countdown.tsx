"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/format";

export function useCountdown(expiresAt?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  const ms = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { ms, label: `${m}:${String(s).padStart(2, "0")}`, expired: !!expiresAt && ms <= 0 };
}

export function HoldCountdown({ expiresAt, className }: { expiresAt: string; className?: string }) {
  const { ms, label } = useCountdown(expiresAt);
  const urgent = ms < 120_000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums",
        urgent ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn",
        className,
      )}
      aria-live="polite"
    >
      <Timer className="size-4" />
      {label}
    </span>
  );
}
