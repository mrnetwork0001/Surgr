import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Surgr — Closed-loop safety for the operating room",
    template: "%s · Surgr",
  },
  description:
    "Surgr listens to the operating room, verifies every verbal drug order against its read-back in real time, tracks the WHO Surgical Safety Checklist as the team speaks it, and speaks up when the loop does not close. Built on AssemblyAI.",
  openGraph: {
    title: "Surgr — Closed-loop safety for the operating room",
    description:
      "Real-time verbal order verification, WHO checklist tracking and spoken safety alerts, built on AssemblyAI streaming, speaker labels, LLM Gateway and the Voice Agent API.",
    siteName: "Surgr",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Surgr operating room safety cockpit" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Surgr — Closed-loop safety for the operating room",
    description: "Every verbal order in the OR, verified out loud.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
