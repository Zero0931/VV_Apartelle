"use client";

import { useState } from "react";
import { Archive, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useQuery, useStore } from "@/lib/data/provider";
import { formatDate, formatPeso } from "@/lib/format";
import type { Room } from "@/lib/types";
import type { RoomInput } from "@/lib/data/store";
import { RequireRole } from "@/components/require-role";
import { RoomVisual } from "@/components/room-visual";
import { ImageUpload } from "@/components/image-upload";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Field, Input, Textarea, Toggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FullPageLoader } from "@/components/ui/spinner";
import { errorMessage, useToast } from "@/components/ui/toast";

const EMPTY: RoomInput = {
  name: "",
  tagline: "",
  description: "",
  capacity: 2,
  bedType: "1 Queen bed",
  amenities: ["Air-conditioned", "Free Wi-Fi", "Hot & cold shower", "Private CR"],
  baseRate: 1200,
};

export default function RoomsPage() {
  return (
    <RequireRole roles={["owner"]}>
      <Rooms />
    </RequireRole>
  );
}

function Rooms() {
  const store = useStore();
  const toast = useToast();
  const { data } = useQuery((s) => s.listRooms({ includeArchived: true }));
  const [editing, setEditing] = useState<Room | "new" | null>(null);
  const [removing, setRemoving] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data) return <FullPageLoader />;
  const current = data.filter((r) => !r.archived);
  const archived = data.filter((r) => r.archived);

  const toggleActive = async (r: Room, active: boolean) => {
    try {
      await store.updateRoom(r.id, { active });
      toast(active ? `${r.name} is open for booking.` : `${r.name} is closed — guests can't book it for now.`);
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await store.removeRoom(removing.id);
      toast(
        res.mode === "archived"
          ? `${removing.name} was removed. Its past bookings are kept for your reports.`
          : `${removing.name} was deleted.`,
      );
      setRemoving(null);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Rooms"
        description={`${current.length} room${current.length === 1 ? "" : "s"} · set base rates, close rooms for maintenance, or expand.`}
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add room
          </Button>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {current.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <RoomVisual room={r} className="h-36 w-full" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {r.name} <span className="font-normal text-muted">· {r.tagline}</span>
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Users className="size-3.5" /> {r.capacity} guests · {r.bedType}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatPeso(r.baseRate)}</p>
                  <p className="text-xs text-muted">base / night</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                <span className="text-sm">
                  {r.active ? (
                    <span className="font-medium text-ok">Open for booking</span>
                  ) : (
                    <span className="font-medium text-warn">Closed (not bookable)</span>
                  )}
                </span>
                <Toggle checked={r.active} onChange={(v) => toggleActive(r, v)} label={`${r.name} open for booking`} />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(r)} className="flex-1">
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(r)} className="text-bad">
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
            <Archive className="size-4" /> Removed rooms
          </h2>
          <Card className="divide-y divide-line">
            {archived.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  {r.name} · {r.tagline}
                </span>
                <span className="text-xs text-muted">
                  Removed {r.archivedAt ? formatDate(r.archivedAt.slice(0, 10), "MMM d, yyyy") : ""} · kept for reports
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {editing && (
        <RoomForm
          room={editing === "new" ? null : editing}
          nextNumber={current.length + archived.length + 1}
          onClose={() => setEditing(null)}
        />
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Keep room
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Remove room
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The room will no longer appear on the booking page. Rooms with upcoming bookings can&apos;t be removed — close
          them instead. Past bookings stay in your revenue reports.
        </p>
      </Modal>
    </div>
  );
}

function RoomForm({ room, nextNumber, onClose }: { room: Room | null; nextNumber: number; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [form, setForm] = useState<RoomInput>(
    room
      ? {
          name: room.name,
          tagline: room.tagline,
          description: room.description,
          capacity: room.capacity,
          bedType: room.bedType,
          amenities: room.amenities,
          baseRate: room.baseRate,
          photo: room.photo,
        }
      : { ...EMPTY, name: `Room ${nextNumber}` },
  );
  const [amenities, setAmenities] = useState(form.amenities.join(", "));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof RoomInput>(k: K, v: RoomInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast("Give the room a name.", "bad");
    if (!(form.baseRate > 0)) return toast("Enter a valid nightly rate.", "bad");
    setBusy(true);
    const input = {
      ...form,
      amenities: amenities
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    };
    try {
      if (room) await store.updateRoom(room.id, input);
      else await store.createRoom(input);
      toast(room ? "Room updated." : `${input.name} added — it's now bookable.`);
      onClose();
    } catch (e) {
      toast(errorMessage(e), "bad");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={room ? `Edit ${room.name}` : "Add a room"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            {room ? "Save changes" : "Add room"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Room name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Type / tagline">
          <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="e.g. Deluxe Queen" />
        </Field>
        <Field label="Base rate per night (₱)" hint="Set special dates on the Rates page.">
          <Input
            type="number"
            min={1}
            step={50}
            value={form.baseRate || ""}
            onChange={(e) => set("baseRate", Number(e.target.value))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max guests">
            <Input
              type="number"
              min={1}
              max={12}
              value={form.capacity || ""}
              onChange={(e) => set("capacity", Number(e.target.value))}
            />
          </Field>
          <Field label="Beds">
            <Input value={form.bedType} onChange={(e) => set("bedType", e.target.value)} />
          </Field>
        </div>
        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Amenities" hint="Separate with commas." className="sm:col-span-2">
          <Input value={amenities} onChange={(e) => setAmenities(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Photo</p>
          <ImageUpload
            value={form.photo}
            onChange={(v) => set("photo", v)}
            label="Upload room photo"
            hint="Optional — a placeholder is shown otherwise."
            maxDim={1000}
            previewClassName="max-h-48"
          />
        </div>
      </div>
    </Modal>
  );
}
