import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MockProvider } from "@/dashboard/mock/MockProvider";
import { env } from "@/shared/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agent Spend Policy Guard",
  description: "Policy enforcement for x402 autonomous agent payments",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <MockProvider enabled={env.USE_MOCKS}>{children}</MockProvider>
      </body>
    </html>
  );
}
