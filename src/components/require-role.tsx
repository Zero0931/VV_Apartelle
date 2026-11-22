"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/data/provider";
import type { Role } from "@/lib/types";
import { FullPageLoader } from "./ui/spinner";
import { EmptyState } from "./ui/card";
import { LinkButton } from "./ui/button";

/**
 * Client-side guard for the demo. In production this becomes Supabase Auth
 * checks in proxy.ts + Row Level Security on the database.
 */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);

  if (!user) return <FullPageLoader />;
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState icon={<ShieldAlert className="size-10" />} title="You don't have access to this page" className="py-24">
        <p>This area is for {roles.join(" / ")} accounts only.</p>
        <LinkButton href="/" variant="secondary" className="mt-4">
          Go home
        </LinkButton>
      </EmptyState>
    );
  }
  return <>{children}</>;
}
