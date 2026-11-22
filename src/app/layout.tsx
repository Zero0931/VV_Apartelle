import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { DataProvider } from "@/lib/data/provider";
import { ToastProvider } from "@/components/ui/toast";
import { FullPageLoader } from "@/components/ui/spinner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "VV Apartelle Panabo — Book your stay",
    template: "%s · VV Apartelle Panabo",
  },
  description:
    "Check room availability and book your daily stay at VV Apartelle Panabo. Pay via GCash, Maya or bank transfer.",
};

export const viewport: Viewport = {
  themeColor: "#f7f5f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          <Suspense fallback={<FullPageLoader />}>
            <DataProvider>{children}</DataProvider>
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
