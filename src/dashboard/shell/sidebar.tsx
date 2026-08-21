"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ArrowLeftRight,
  ShieldCheck,
  Store,
  ScrollText,
  PlayCircle,
  Shield,
  Sliders,
  Sparkles,
} from "lucide-react";

/** OWNER: UI · Navigation. Order matches the demo flow. */
export const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/policies", label: "Policies", icon: Sliders },
  { href: "/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/merchants", label: "Merchants", icon: Store },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/simulator", label: "Simulator", icon: PlayCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
          <Shield className="h-5 w-5 fill-white/20 text-white" />
        </div>
        <div>
          <div className="font-bold text-base tracking-wider text-white flex items-center gap-2 font-mono">
            WARDEN
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
              x402
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Autonomous Policy Guard</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav aria-label="Main" className="flex-1 px-3 py-4 space-y-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/overview" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Network</span>
          <span className="font-mono text-slate-300 font-medium">Algorand TestNet</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Guard Mode</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium font-mono text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active (Live)
          </span>
        </div>
      </div>
    </aside>
  );
}
