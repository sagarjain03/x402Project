"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, Activity, CheckCircle2, Shield } from "lucide-react";
import { ApprovalsBell } from "@/dashboard/components/approvals-bell";

export const TOP_NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/transactions", label: "Transactions" },
  { href: "/agents", label: "Agents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/merchants", label: "Merchants" },
  { href: "/audit", label: "Audit Log" },
  { href: "/console", label: "Agent Console" },
  { href: "/simulator", label: "Simulator" },
];

/** OWNER: UI · Global header with top navbar. */
export function Header() {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    setResetDone(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setResetDone(true);
      setTimeout(() => setResetDone(false), 2500);
    } finally {
      setResetting(false);
    }
  };

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand Logo & Status */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 text-slate-900 group cursor-pointer">
          <div className="h-8 w-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:bg-blue-700 transition-all">
            <Shield className="h-4 w-4 fill-white/20" />
          </div>
          <span className="font-extrabold text-base font-mono tracking-wider text-slate-900">
            WARDEN
          </span>
        </Link>

        {/* Center: Top Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {TOP_NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Live Status & Reset */}
      <div className="flex items-center gap-3">
        <ApprovalsBell />

        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
          <Activity className="h-3 w-3 text-emerald-600 animate-pulse" />
          Gateway Live
        </span>

        {resetDone && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium animate-in fade-in font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reseeded
          </span>
        )}

        <button
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl border border-slate-200 transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
        >
          <RotateCcw className={`h-3.5 w-3.5 text-slate-600 ${resetting ? "animate-spin" : ""}`} />
          <span>{resetting ? "Resetting..." : "Reset Demo"}</span>
        </button>
      </div>
    </header>
  );
}
