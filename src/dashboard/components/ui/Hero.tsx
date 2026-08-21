"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { CloudShader } from "./cloud-shader";

export type HeroProps = {
  title?: string;
  subtitle?: string;
  withShader?: boolean;
};

export function Hero({
  title = "WARDEN",
  subtitle = "Deterministic policy enforcement and a cryptographic audit trail for autonomous agent spend on Algorand TestNet.",
  withShader = false,
}: HeroProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/transactions", label: "Transactions" },
    { href: "/console", label: "Console" },
    { href: "/approvals", label: "Approvals" },
    { href: "/agents", label: "Agents", hideOnMobile: true },
    { href: "/audit", label: "Audit Log" },
    { href: "/merchants", label: "Merchants" },
    { href: "/simulator", label: "Attack Drills" },
  ] as const;

  const isActiveNav = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const scrollToOverview = () => {
    const el = document.getElementById("overview-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const content = (
    <div className="relative z-20 flex flex-col justify-between min-h-[75vh] w-full">
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-white group cursor-pointer">
          <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-xs group-hover:bg-white/25 transition-all">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <span className="font-black text-xl tracking-wider text-white drop-shadow-sm uppercase">
            WARDEN
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-semibold text-white/90">
          {navItems.map((item) => {
            const isActive = isActiveNav(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`transition-colors drop-shadow-sm underline-offset-4 ${item.hideOnMobile ? "hidden sm:inline " : ""
                  }${isActive
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

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 px-6 sm:px-12 md:px-16 text-left max-w-7xl mx-auto w-full py-8 sm:py-12 -mt-4 sm:-mt-8">
        <div className="flex-1 flex flex-col items-start justify-center max-w-2xl">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-blue-950 tracking-wider uppercase drop-shadow-[0_2px_12px_rgba(255,255,255,0.65)]">
            {title}
          </h1>

          <p className="mt-3 text-lg sm:text-xl md:text-2xl text-blue-900 font-semibold tracking-wide drop-shadow-[0_1px_8px_rgba(255,255,255,0.7)] max-w-2xl leading-relaxed">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-start gap-4">
            <button
              type="button"
              onClick={scrollToOverview}
              className="px-8 py-3 rounded-full bg-blue-950 text-white font-bold text-sm tracking-wide shadow-[0_12px_30px_rgba(15,23,42,0.35)] hover:bg-blue-900 active:scale-98 transition-all cursor-pointer"
            >
              Overview
            </button>

            <Link
              href="/console"
              className="px-7 py-3.5 rounded-full bg-white/80 hover:bg-white active:scale-98 backdrop-blur-md border border-white/80 text-blue-900 font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer"
            >
              Agent Console
            </Link>

            <Link
              href="/simulator"
              className="px-7 py-3.5 rounded-full bg-white/60 hover:bg-white/80 active:scale-98 backdrop-blur-md border border-white/70 text-blue-900 font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer"
            >
              Attack Drills (D1-D7)
            </Link>
          </div>
        </div>

        <div className="flex-1 w-full max-w-lg lg:max-w-xl flex justify-center lg:justify-end">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl shadow-blue-950/25 animate-float transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-blue-500/20 hover:border-white/60">
            <img
              src="/warden-agent-image.jpeg"
              alt="An autonomous agent offers a payment while Warden approves and blocks requests."
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/20" />
          </div>
        </div>
      </div>

      <div className="h-4 w-full pointer-events-none" />
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
