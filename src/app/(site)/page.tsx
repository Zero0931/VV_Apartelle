"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Check, Lock, MailCheck, QrCode, Users } from "lucide-react";
import { useQuery } from "@/lib/data/provider";
import { formatPeso, formatTime12, todayKey } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { RoomVisual } from "@/components/room-visual";

const STEPS = [
  { icon: CalendarCheck, title: "Pick your nights", text: "Choose rooms and dates." },
  { icon: Lock, title: "We hold them", text: "Reserved while you pay." },
  { icon: QrCode, title: "Pay by QR", text: "GCash, Maya or bank transfer." },
  { icon: MailCheck, title: "Get your receipt", text: "Show it at the front desk." },
];

export default function HomePage() {
  const today = todayKey();
  const { data } = useQuery(async (s) => {
    const [avail, settings] = await Promise.all([s.getAvailability(today, 7), s.getSettings()]);
    return { avail, settings };
  }, [today]);

  const rooms = data?.avail.rooms.filter((r) => r.active) ?? [];
  const freeTonight = rooms.filter((r) => data?.avail.cells[r.id][today].status === "available").length;
  const minRate = rooms.length ? Math.min(...rooms.map((r) => r.baseRate)) : 0;

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Transient rooms · Panabo City</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
            Stay in Panabo, one night at a time.
          </h1>
          <p className="mt-4 max-w-lg text-base text-muted sm:text-lg">
            Pay per night. No deposit. Book online in minutes.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LinkButton href="/book" size="lg">
              Check availability <ArrowRight className="size-4" />
            </LinkButton>
            {minRate > 0 && <span className="text-sm text-muted">Rooms from {formatPeso(minRate)} / night</span>}
          </div>
          {data && (
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm">
              <span className={`size-2 rounded-full ${freeTonight ? "bg-ok" : "bg-bad"}`} />
              {freeTonight
                ? `${freeTonight} of ${rooms.length} rooms available tonight`
                : "Fully booked tonight — check other dates"}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rooms.slice(0, 3).map((r, i) => (
            <RoomVisual
              key={r.id}
              room={r}
              className={i === 0 ? "col-span-2 h-48 rounded-2xl sm:h-56" : "h-36 rounded-2xl sm:h-44"}
            />
          ))}
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Our rooms</h2>
            <p className="mt-1 text-sm text-muted">Per night. Holiday rates may apply.</p>
          </div>
          <Link href="/book" className="text-sm font-medium text-accent hover:underline">
            See all dates →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => (
            <article key={r.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <RoomVisual room={r} className="h-44 w-full" />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {r.name} <span className="font-normal text-muted">· {r.tagline}</span>
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <Users className="size-3.5" /> Up to {r.capacity} guests · {r.bedType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPeso(r.baseRate)}</p>
                    <p className="text-xs text-muted">per night</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">{r.description}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {r.amenities.map((a) => (
                    <li key={a} className="rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
                      {a}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                  <span className="text-xs text-muted">
                    Tonight:{" "}
                    {data?.avail.cells[r.id][today].status === "available" ? (
                      <span className="font-medium text-ok">Available</span>
                    ) : (
                      <span className="font-medium text-bad">Taken</span>
                    )}
                  </span>
                  <LinkButton href={`/book?room=${r.id}`} size="sm" variant="secondary">
                    Book {r.name}
                  </LinkButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">How booking works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <s.icon className="size-5 text-accent" />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* House info */}
      {data && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-6 rounded-2xl bg-ink p-8 text-white md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-display text-2xl font-semibold">Good to know</h2>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                {[
                  `Check-in ${formatTime12(data.settings.checkInTime)} · Check-out ${formatTime12(data.settings.checkOutTime)}`,
                  "Pay per night. No deposit.",
                  `Rooms held ${data.settings.holdMinutes} min while you pay`,
                  "Show your booking QR on arrival",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-soft" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-3 rounded-xl bg-white/5 p-5">
              <p className="text-sm text-white/70">{data.settings.address}</p>
              <p className="text-lg font-semibold">{data.settings.contactPhone}</p>
              <LinkButton href="/book" variant="accent" className="mt-1">
                Book your stay
              </LinkButton>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
