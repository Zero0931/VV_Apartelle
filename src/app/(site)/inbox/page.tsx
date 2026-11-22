"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Inbox as InboxIcon, MailOpen } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import { cn, formatDateTime } from "@/lib/format";
import { RequireRole } from "@/components/require-role";
import { EmailView } from "@/components/email-view";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/spinner";

export default function InboxPage() {
  return (
    <RequireRole>
      <Inbox />
    </RequireRole>
  );
}

function Inbox() {
  const store = useStore();
  const { data } = useQuery(async (s) => {
    const [emails, rooms, settings, bookings] = await Promise.all([
      s.listEmails(),
      s.listRooms({ includeArchived: true }),
      s.getSettings(),
      s.listBookings(),
    ]);
    return { emails, rooms, settings, bookings };
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const selected = data?.emails.find((e) => e.id === openId);
  useEffect(() => {
    if (selected && !selected.read) store.markEmailRead(selected.id);
  }, [selected, store]);

  if (!data) return <FullPageLoader />;
  const user = data.emails[0]?.to;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader
        title="Demo inbox"
        description={
          <>
            Simulated emails{user ? ` to ${user}` : ""}.
          </>
        }
      />
      <Card className="grid min-h-[520px] overflow-hidden md:grid-cols-[320px_1fr]">
        <ul className={cn("divide-y divide-line border-line md:border-r", selected && "hidden md:block")}>
          {data.emails.length === 0 && (
            <EmptyState icon={<InboxIcon className="size-8" />} title="No emails yet" />
          )}
          {data.emails.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setOpenId(e.id)}
                className={cn(
                  "block w-full px-4 py-3 text-left transition hover:bg-paper",
                  e.id === openId && "bg-paper",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm", !e.read && "font-semibold")}>VV Apartelle Panabo</span>
                  {!e.read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </div>
                <p className={cn("mt-0.5 line-clamp-2 text-sm", e.read ? "text-muted" : "text-ink")}>{e.subject}</p>
                <p className="mt-1 text-[11px] text-subtle">{formatDateTime(e.sentAt)}</p>
              </button>
            </li>
          ))}
        </ul>
        <div className={cn("min-w-0", !selected && "hidden md:block")}>
          {selected ? (
            <>
              <button
                onClick={() => setOpenId(null)}
                className="flex items-center gap-1.5 px-5 pt-4 text-sm text-muted md:hidden"
              >
                <ArrowLeft className="size-4" /> All emails
              </button>
              <EmailView
                email={selected}
                booking={data.bookings.find((b) => b.id === selected.bookingId)}
                rooms={data.rooms}
                settings={data.settings}
              />
            </>
          ) : (
            <EmptyState icon={<MailOpen className="size-10" />} title="Select an email to read" className="h-full" />
          )}
        </div>
      </Card>
    </div>
  );
}
