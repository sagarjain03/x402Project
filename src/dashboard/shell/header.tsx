"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ApprovalsBell } from "@/dashboard/components/approvals-bell";

export const TOP_NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/console", label: "Agent Console" },
  { href: "/transactions", label: "Transactions" },
  { href: "/approvals", label: "Approvals" },
  { href: "/agents", label: "Agents" },
  { href: "/audit", label: "Audit Log" },
  { href: "/simulator", label: "Attack Drills" },
];

/** OWNER: UI · Global header with top navbar & mobile drawer. */
export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isOverview = pathname === "/overview" || pathname === "/";

  return (
    <header
      className={`h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300 ${
        isOverview
          ? "bg-transparent border-b border-white/10 text-white shadow-none"
          : "bg-white/90 backdrop-blur-md border-b border-slate-200/80 text-slate-900 shadow-xs"
      }`}
    >
      {/* Left: Brand Logo & Status */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <span
            className={`font-black text-lg font-mono tracking-tight transition-colors ${
              isOverview
                ? "text-white group-hover:text-white/80"
                : "text-slate-900 group-hover:text-slate-700"
            }`}
          >
            WARDEN
          </span>
        </Link>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {TOP_NAV.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? isOverview
                      ? "bg-white text-slate-950 shadow-xs font-bold"
                      : "bg-slate-900 text-white shadow-xs font-bold"
                    : isOverview
                      ? "text-white/80 hover:text-white hover:bg-white/15"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Live Status, Approvals & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <ApprovalsBell />

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`lg:hidden p-2 rounded-xl transition-colors cursor-pointer ${
            isOverview
              ? "text-white/80 hover:text-white hover:bg-white/15"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Slide-down Drawer */}
      {mobileMenuOpen && (
        <div
          className={`lg:hidden absolute top-16 left-0 w-full border-b shadow-xl py-4 px-6 z-40 space-y-1.5 animate-in slide-in-from-top-2 duration-150 ${
            isOverview
              ? "bg-slate-900/95 backdrop-blur-xl border-white/10 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {TOP_NAV.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? isOverview
                      ? "bg-white text-slate-950 shadow-xs font-bold"
                      : "bg-slate-900 text-white shadow-xs font-bold"
                    : isOverview
                      ? "text-white/80 hover:bg-white/15 hover:text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}

