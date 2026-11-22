import { BedDouble } from "lucide-react";
import { cn } from "@/lib/format";
import type { Room } from "@/lib/types";
import { DataImage } from "./logo";

const TONES = [
  "from-[#e9dcc6] to-[#c9b08a]",
  "from-[#dfe3dc] to-[#a9b5a3]",
  "from-[#e6d6d0] to-[#bf9d90]",
  "from-[#d9dde6] to-[#9ea8bd]",
  "from-[#ece2cf] to-[#b9a072]",
];

export function RoomVisual({ room, className }: { room: Room; className?: string }) {
  if (room.photo) {
    return <DataImage src={room.photo} alt={room.name} className={cn("object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        TONES[(room.sortOrder - 1) % TONES.length],
        className,
      )}
      aria-hidden
    >
      <BedDouble className="size-14 text-white/80" strokeWidth={1.25} />
      <span className="absolute bottom-3 left-4 font-display text-lg font-semibold text-white/90">{room.name}</span>
    </div>
  );
}
