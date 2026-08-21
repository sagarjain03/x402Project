"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { CloudShader } from "./cloud-shader";
import { WardenIllustration } from "./warden-illustration";

export type HeroProps = {
  title?: string;
  subtitle?: string;
  withShader?: boolean;
};

export function Hero({
  title = "WARDEN",
  subtitle = "Control autonomous spending",
  withShader = false,
}: HeroProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/transactions", label: "Transactions" },
    { href: "/agents", label: "Agents", hideOnMobile: true },
    { href: "/audit", label: "Audit Log" },
    { href: "/merchants", label: "Merchants" },
    { href: "/approvals", label: "Approval" },
  ] as const;

  const isActiveNav = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const scrollToOverview = () => {
    const el = document.getElementById("overview-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const content = (
    <div className="relative z-20 flex flex-col justify-between min-h-[85vh] w-full">
      {/* 1. Top Navbar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-white group cursor-pointer">
          <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xs group-hover:bg-white/25 transition-all">
            <Shield className="h-5 w-5 fill-white/20 text-white" />
          </div>
          <span className="font-black text-xl tracking-wider text-white drop-shadow-sm uppercase">
            WARDEN
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-4 sm:gap-7 text-sm font-medium text-white/90">
          {navItems.map((item) => {
            const isActive = isActiveNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`transition-colors drop-shadow-sm underline-offset-4 ${
                  item.hideOnMobile ? "hidden sm:inline " : ""
                }${
                  isActive
                    ? "text-white font-semibold underline decoration-2"
                    : "hover:text-white hover:underline"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* 2. Centered Hero Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center max-w-4xl mx-auto">
        {/* Cartoon Illustration (Robot + Guard with Shield) */}
        <div className="w-full max-w-md md:max-w-xl mb-3">
          <WardenIllustration />
        </div>

        {/* Headline Typography. Navy, not white: the sky carries white clouds behind this text and
            white-on-cloud disappears. The pale halo keeps it separated from the darker sky above. */}
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-blue-950 tracking-wider uppercase drop-shadow-[0_2px_12px_rgba(255,255,255,0.65)]">
          {title}
        </h1>

        {/* Tagline */}
        <p className="mt-2 text-xl sm:text-2xl text-blue-900 font-semibold tracking-wide drop-shadow-[0_1px_8px_rgba(255,255,255,0.7)]">
          {subtitle}
        </p>

        {/* Action Pill Buttons */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={scrollToOverview}
            className="px-8 py-3 rounded-full bg-blue-950 text-white font-bold text-sm tracking-wide shadow-[0_12px_30px_rgba(15,23,42,0.35)] hover:bg-blue-900 active:scale-98 transition-all cursor-pointer"
          >
            Overview
          </button>

          <Link
            href="/simulator"
            className="px-8 py-3 rounded-full bg-white/65 hover:bg-white/80 active:scale-98 backdrop-blur-md border border-white/80 text-blue-900 font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer"
          >
            Simulator
          </Link>
        </div>
      </div>

      {/* Decorative Bottom Spacer */}
      <div className="h-6 w-full pointer-events-none" />
    </div>
  );

  if (withShader) {
    return (
      <CloudShader
        className="relative w-full min-h-[85vh] overflow-hidden flex flex-col justify-between"
        speed={0.85}
        count={6}
        cloudColor="#ffffff"
        skyTopColor="#1d64c2"
        skyBottomColor="#6ba7f7"
      >
        {content}
      </CloudShader>
    );
  }

  return content;
}

export default Hero;
