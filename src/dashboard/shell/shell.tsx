"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/dashboard/shell/header";

/** OWNER: UI · Dashboard layout without sidebar (Top Navbar Shell). */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === "/overview" || pathname === "/";

  // For /overview and root /, Overview renders its own full Hero with Top Navbar + embedded cards
  if (isOverview) {
    return <div className="min-h-screen bg-slate-100 text-slate-900 antialiased font-sans">{children}</div>;
  }

  // For all sub-pages, render top header navigation bar + clean full-width container
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans flex flex-col">
      <Header />
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
