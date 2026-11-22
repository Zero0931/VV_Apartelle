"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Inbox, LayoutDashboard, LogIn, LogOut, Menu, Receipt, X } from "lucide-react";
import { useAuth, useQuery } from "@/lib/data/provider";
import { cn } from "@/lib/format";
import { Logo } from "./logo";
import { buttonClass } from "./ui/button";

export function DemoBanner() {
  return (
    <div className="no-print bg-ink px-4 py-1.5 text-center text-xs text-white/80">
      <span className="font-semibold text-white">Demo version</span> — data is saved only in this browser.{" "}
      <Link href="/login" className="underline underline-offset-2 hover:text-white">
        Quick-login as Guest, Front Desk or Owner
      </Link>
    </div>
  );
}

export function SiteNav() {
  const { user, isStaff, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: emails } = useQuery((s) => (user ? s.listEmails() : Promise.resolve([])), [user?.id]);
  const unread = emails?.filter((e) => !e.read).length ?? 0;

  const links = [
    { href: "/book", label: "Book a room", icon: CalendarDays },
    ...(user
      ? [
          { href: "/bookings", label: "My bookings", icon: Receipt },
          { href: "/inbox", label: "Inbox", icon: Inbox, badge: unread },
        ]
      : []),
    ...(isStaff ? [{ href: "/admin", label: "Admin", icon: LayoutDashboard }] : []),
  ];

  const logout = async () => {
    await signOut();
    setOpen(false);
    router.push("/");
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(l.href) ? "bg-ink/5 text-ink" : "text-muted hover:text-ink",
              )}
            >
              <l.icon className="size-4" />
              {l.label}
              {"badge" in l && !!l.badge && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white">{l.badge}</span>
              )}
            </Link>
          ))}
          <div className="ml-2 h-6 w-px bg-line" />
          {user ? (
            <div className="ml-2 flex items-center gap-2">
              <span className="max-w-40 truncate text-sm text-muted" title={user.email}>
                {user.name.split(" ")[0]}
              </span>
              <button onClick={logout} className={buttonClass("ghost", "sm")}>
                <LogOut className="size-4" /> Log out
              </button>
            </div>
          ) : (
            <Link href="/login" className={buttonClass("primary", "sm", "ml-2")}>
              <LogIn className="size-4" /> Log in
            </Link>
          )}
        </nav>
        <button
          className="relative rounded-lg p-2 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
          {!open && unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-paper px-4 pb-4 pt-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-2 py-3 text-base font-medium"
            >
              <l.icon className="size-5 text-muted" />
              {l.label}
              {"badge" in l && !!l.badge && (
                <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white">{l.badge}</span>
              )}
            </Link>
          ))}
          <div className="mt-2 border-t border-line pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">{user.email}</span>
                <button onClick={logout} className={buttonClass("secondary", "sm")}>
                  Log out
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className={buttonClass("primary", "md", "w-full")}>
                Log in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { data: settings } = useQuery((s) => s.getSettings());
  return (
    <footer className="no-print mt-16 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3">Affordable, clean and secure daily stays in {settings?.address ?? "Panabo City"}.</p>
        </div>
        <div>
          <p className="font-medium text-ink">Contact</p>
          <p className="mt-2">{settings?.contactPhone}</p>
          <p>{settings?.contactEmail}</p>
        </div>
        <div>
          <p className="font-medium text-ink">House times</p>
          <p className="mt-2">Check-in from 2:00 PM · Check-out until 12:00 NN</p>
          <p className="mt-1 text-xs">Demo prototype · not a live booking site</p>
        </div>
      </div>
    </footer>
  );
}
