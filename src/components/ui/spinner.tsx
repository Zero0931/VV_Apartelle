import { cn } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center text-muted">
      <Spinner className="size-6" />
    </div>
  );
}
