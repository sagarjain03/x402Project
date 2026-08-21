"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/dashboard/shell/header";

const NAV_INDEX: Record<string, number> = {
  "/overview": 0,
  "/": 0,
  "/console": 1,
  "/transactions": 2,
  "/approvals": 3,
  "/agents": 4,
  "/audit": 5,
  "/simulator": 6,
};

/** OWNER: UI · Dashboard layout with static top navbar and direction-aware carousel slide page transitions. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const [slideDirection, setSlideDirection] = useState<"right" | "left">("right");

  useEffect(() => {
    const prevPath = prevPathnameRef.current;
    if (prevPath !== pathname) {
      const prevIdx = NAV_INDEX[prevPath] ?? 0;
      const currIdx = NAV_INDEX[pathname] ?? 0;

      if (currIdx >= prevIdx) {
        setSlideDirection("right");
      } else {
        setSlideDirection("left");
      }

      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  const isOverview = pathname === "/overview" || pathname === "/";
  const initialX = slideDirection === "right" ? 50 : -50;

  return (
    <div className={`min-h-screen antialiased font-sans flex flex-col overflow-x-hidden ${
      isOverview ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
    }`}>
      {/* Top Navbar remains static across page navigations */}
      <Header />

      {/* Main Content Area: Smooth carousel horizontal slide */}
      <main className="flex-1 w-full overflow-x-hidden relative">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x: initialX }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`w-full ${
            isOverview ? "" : "p-6 md:p-8 max-w-7xl mx-auto"
          }`}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
