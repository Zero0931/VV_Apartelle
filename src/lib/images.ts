import QRCode from "qrcode";
import { formatPeso, METHOD_LABEL } from "./format";
import type { PaymentMethod } from "./types";

/** Resize + re-encode an uploaded image so it fits comfortably in localStorage. */
export function compressImage(file: File, maxDim = 900, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

export function makeQrDataUrl(text: string, width = 360): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
}

const METHOD_COLOR: Record<PaymentMethod, string> = {
  gcash: "#1d5fd1",
  maya: "#0f9d6b",
  bank: "#3b3b3b",
};

/** Draws a generic, clearly-labelled DEMO payment confirmation screenshot. */
export function makeDemoReceiptImage(opts: {
  method: PaymentMethod;
  amount: number;
  referenceNo: string;
  payer: string;
  when: Date;
}): string {
  const w = 360;
  const h = 560;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f4f5f7";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = METHOD_COLOR[opts.method];
  ctx.fillRect(0, 0, w, 150);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "600 16px sans-serif";
  ctx.fillText(`${METHOD_LABEL[opts.method]} · Sent`, w / 2, 48);
  ctx.font = "700 34px sans-serif";
  ctx.fillText(formatPeso(opts.amount), w / 2, 100);
  ctx.font = "12px sans-serif";
  ctx.fillText("DEMO SCREENSHOT — NOT A REAL TRANSACTION", w / 2, 132);

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(20, 170, w - 40, 300, 14);
  ctx.fill();
  ctx.textAlign = "left";
  const rows: [string, string][] = [
    ["Sent to", "VV Apartelle Panabo"],
    ["From", opts.payer],
    ["Amount", formatPeso(opts.amount)],
    ["Ref. No.", opts.referenceNo],
    ["Date", opts.when.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })],
  ];
  rows.forEach(([k, v], i) => {
    const y = 210 + i * 52;
    ctx.fillStyle = "#6b7280";
    ctx.font = "12px sans-serif";
    ctx.fillText(k, 40, y);
    ctx.fillStyle = "#111827";
    ctx.font = "600 15px sans-serif";
    ctx.fillText(v, 40, y + 20);
  });
  ctx.fillStyle = "#16a34a";
  ctx.textAlign = "center";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("✓ Transaction successful", w / 2, 510);
  return c.toDataURL("image/jpeg", 0.7);
}
