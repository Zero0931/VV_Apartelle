import { CheckCircle2, CircleDashed, Clock, DoorOpen, Hourglass, LogOut, Ban, XCircle } from "lucide-react";
import { cn, STATUS_LABEL } from "@/lib/format";
import type { BookingStatus } from "@/lib/types";

const STYLE: Record<BookingStatus, { cls: string; Icon: typeof Clock }> = {
  hold: { cls: "bg-warn-soft text-warn", Icon: Hourglass },
  pending_verification: { cls: "bg-info-soft text-info", Icon: Clock },
  confirmed: { cls: "bg-ok-soft text-ok", Icon: CheckCircle2 },
  checked_in: { cls: "bg-accent-soft text-accent-strong", Icon: DoorOpen },
  completed: { cls: "bg-ink/5 text-ink-soft", Icon: LogOut },
  expired: { cls: "bg-ink/5 text-muted", Icon: CircleDashed },
  rejected: { cls: "bg-bad-soft text-bad", Icon: XCircle },
  cancelled: { cls: "bg-bad-soft text-bad", Icon: Ban },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const { cls, Icon } = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        cls,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
