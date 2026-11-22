import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/format";

export function Logo({ className, withText = true, href = "/" }: { className?: string; withText?: boolean; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="VV Apartelle Panabo — home">
      <Image
        src="/logo.jpg"
        alt=""
        width={44}
        height={44}
        className="size-11 rounded-md object-cover mix-blend-multiply"
        priority
      />
      {withText && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-semibold tracking-tight">VV Apartelle</span>
          <span className="block text-[11px] uppercase tracking-[0.18em] text-muted">Panabo</span>
        </span>
      )}
    </Link>
  );
}

/** Plain <img> for user-provided data URLs (QR codes, screenshots, room photos). */
export function DataImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
