"use client";

import React from "react";
import Link from "next/link";
import { CloudShader } from "./cloud-shader";
import { WardenIllustration } from "./warden-illustration";

export type HeroProps = {
  title?: string;
  subtitle?: string;
  withShader?: boolean;
};

export function Hero({
  title = "WARDEN",
  subtitle = "Deterministic policy enforcement and a cryptographic audit trail for autonomous agent spend.",
  withShader = false,
}: HeroProps) {
  const scrollToOverview = () => {
    const el = document.getElementById("overview-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const content = (
    <div className="relative z-20 flex flex-col justify-between min-h-[60vh] w-full pt-8 sm:pt-12">

      <div className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 px-6 sm:px-12 md:px-16 text-left max-w-7xl mx-auto w-full py-8 sm:py-12 -mt-4 sm:-mt-8">
        <div className="flex-1 flex flex-col items-start justify-center max-w-2xl">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.08] drop-shadow-sm">
            {title}
          </h1>

          <p className="mt-4 text-base sm:text-lg md:text-xl text-white/90 font-medium tracking-normal leading-relaxed max-w-xl">
            {subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-start gap-3.5">
            <button
              type="button"
              onClick={scrollToOverview}
              className="px-7 py-3 rounded-xl bg-white text-slate-950 font-bold text-sm shadow-lg hover:bg-slate-100 hover:shadow-xl active:scale-95 transition-all cursor-pointer"
            >
              Overview
            </button>

            <Link
              href="/console"
              className="px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white font-bold text-sm shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Agent Console
            </Link>

            <Link
              href="/simulator"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white/90 font-bold text-sm shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Attack Drills (D1-D7)
            </Link>
          </div>
        </div>

        <div className="flex-1 w-full max-w-lg lg:max-w-xl flex justify-center lg:justify-end">
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-white/5 backdrop-blur-md border border-white/20 shadow-2xl shadow-slate-950/40 animate-float transition-all duration-500 ease-out hover:scale-[1.02] hover:border-white/35 flex items-center justify-center p-6">
            <WardenIllustration className="w-full max-w-xl h-auto" />
            <div className="absolute inset-0 pointer-events-none rounded-3xl ring-1 ring-inset ring-white/15" />
          </div>
        </div>
      </div>

      <div className="h-4 w-full pointer-events-none" />
    </div>
  );

  if (withShader) {
    return (
      <CloudShader
        className="relative w-full min-h-[85vh] overflow-hidden flex flex-col justify-between bg-slate-950"
        speed={0.85}
        count={6}
        cloudColor="#38bdf8"
        skyTopColor="#090d16"
        skyBottomColor="#1e293b"
      >
        {content}
      </CloudShader>
    );
  }

  return content;
}

export default Hero;
