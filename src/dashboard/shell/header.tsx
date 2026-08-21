"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Menu, Shield, X } from "lucide-react";
import { ApprovalsBell } from "@/dashboard/components/approvals-bell";
import { Badge } from "@/dashboard/components/ui/badge";

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

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
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

      {/* Right: Live Status, Approvals & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        <ApprovalsBell />

        <Badge
          variant="success"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[11px] font-semibold"
        >
          <Activity className="h-3 w-3 text-emerald-600 animate-pulse" />
          Algorand TestNet
        </Badge>

        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Slide-down Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 w-full bg-white border-b border-slate-200 shadow-xl py-4 px-6 z-40 space-y-1.5 animate-in slide-in-from-top-2 duration-150">
          {TOP_NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
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

