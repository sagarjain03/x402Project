"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * `enabled` comes from USE_MOCKS, read by the server layout — a client component cannot see a
 * non-NEXT_PUBLIC variable. Off means the worker never starts, so the dashboard reaches the real
 * API. Leaving it always-on races MSW against the real API and paints fixtures next to live rows.
 */
export function MockProvider({ children, enabled = false }: { children: ReactNode; enabled?: boolean }) {
  const [mockReady, setMockReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    async function initMocks() {
      if (typeof window !== "undefined") {
        try {
          const { worker } = await import("@/dashboard/mock/browser");
          await worker.start({
            onUnhandledRequest: "bypass",
            serviceWorker: {
              url: "/mockServiceWorker.js",
            },
          });
          console.log("[MSW] Mock Service Worker ready.");
        } catch (error) {
          console.error("[MSW] Failed to start Mock Service Worker:", error);
        }
      }
      if (isMounted) {
        setMockReady(true);
      }
    }

    initMocks();

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  if (!mockReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-2 text-sm text-zinc-500 font-mono">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          Initializing Policy Gateway...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
