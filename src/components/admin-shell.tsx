"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  BedDouble,
  CalendarCog,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  QrCode,
  ScanLine,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { useAuth, useQuery } from "@/lib/data/provider";
import { cn } from "@/lib/format";
import type { Role } from "@/lib/types";
import { Logo } from "./logo";
import { RequireRole } from "./require-role";

const NAV: { href: string; label: string; icon: typeof BedDouble; roles: Role[]; badge?: "pending" }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["owner"] },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList, roles: ["owner", "admin"], badge: "pending" },
  { href: "/admin/check-in", label: "Front desk", icon: ScanLine, roles: ["owner", "admin"] },
  { href: "/admin/rooms", label: "Rooms", icon: BedDouble, roles: ["owner"] },
  { href: "/admin/rates", label: "Rates", icon: CalendarCog, roles: ["owner"] },
  { href: "/admin/payments", label: "Payment QR", icon: QrCode, roles: ["owner"] },
  { href: "/admin/customers", label: "Customers", icon: Users, roles: ["owner"] },
  { href: "/admin/staff", label: "Staff", icon: UserCog, roles: ["owner"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["owner"] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireRole roles={["owner", "admin"]}>
      <Shell>{children}</Shell>
    </RequireRole>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { data: pending } = useQuery(
    async (s) => (await s.listBookings({ statuses: ["pending_verification"] })).length,
  );
  const items = NAV.filter((n) => user && n.roles.includes(user.role));
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const logout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo href="/admin" />
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(n.href) ? "bg-ink text-white" : "text-muted hover:bg-paper hover:text-ink",
              )}
            >
              <n.icon className="size-4" />
              <span className="flex-1">{n.label}</span>
              {n.badge && !!pending && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-4 text-sm">
          <p className="truncate font-medium">{user?.name}</p>
          <p className="text-xs capitalize text-muted">{user?.role === "admin" ? "Front desk admin" : "Owner"}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/" className="flex items-center gap-1 text-xs text-muted hover:text-ink">
              <ExternalLink className="size-3.5" /> View site
            </Link>
            <button onClick={logout} className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-bad">
              <LogOut className="size-3.5" /> Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo href="/admin" />
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="text-muted">
              View site
            </Link>
            <button onClick={logout} className="text-muted" aria-label="Log out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
        <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-2">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                isActive(n.href) ? "bg-ink text-white" : "bg-paper text-muted",
              )}
            >
              <n.icon className="size-3.5" />
              {n.label}
              {n.badge && !!pending && <span className="rounded-full bg-accent px-1 text-[10px] text-white">{pending}</span>}
            </Link>
          ))}
        </nav>
      </header>

      <main className="min-w-0 flex-1 bg-paper">
        <div className="no-print border-b border-line bg-ink px-4 py-1.5 text-center text-xs text-white/80">
          <b className="text-white">Demo</b> — logged in as {user?.name} ({user?.role === "admin" ? "front desk admin" : "owner"})
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
