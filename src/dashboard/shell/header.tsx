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

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand Logo & Status */}
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 text-slate-900 group cursor-pointer">
          <span className="font-black text-lg font-mono tracking-tight text-slate-900 group-hover:text-slate-700 transition-colors">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isActive
                    ? "bg-slate-900 text-white shadow-xs font-bold"
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
                className={`block px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive
                    ? "bg-slate-900 text-white shadow-xs"
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

