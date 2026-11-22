"use client";

import { ImageUp, X } from "lucide-react";
import { useRef, useState } from "react";
import { compressImage } from "@/lib/images";
import { cn } from "@/lib/format";
import { DataImage } from "./logo";
import { Spinner } from "./ui/spinner";

export function ImageUpload({
  value,
  onChange,
  label = "Upload image",
  hint,
  maxDim = 900,
  className,
  previewClassName = "max-h-64",
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  label?: string;
  hint?: string;
  maxDim?: number;
  className?: string;
  previewClassName?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await compressImage(file, maxDim));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative inline-block">
          <DataImage src={value} alt="Uploaded image" className={cn("rounded-lg border border-line", previewClassName)} />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white shadow"
            aria-label="Remove image"
          >
            <X className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="mt-2 block text-xs font-medium text-accent hover:underline"
          >
            Replace image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-paper px-4 py-8 text-sm text-muted transition hover:border-ink hover:text-ink"
        >
          {busy ? <Spinner /> : <ImageUp className="size-7" />}
          <span className="font-medium text-ink">{label}</span>
          {hint && <span className="text-xs">{hint}</span>}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
}
