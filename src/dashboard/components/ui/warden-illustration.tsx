"use client";

// OWNER: UI · Hero illustration: the agent offers a payment, the Warden clears it, the red dot is
// the spend that never happened. Served PNG is public/warden-agent-image.jpeg with its background
// removed by an edge flood fill, so the Warden's white face stays opaque while the sky shows through.
import Image from "next/image";

export function WardenIllustration({ className = "w-full max-w-lg h-auto" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <Image
        src="/warden-hero.png"
        alt="An autonomous agent offers a payment; the Warden approves it and refuses the next one."
        width={571}
        height={260}
        priority
        className="w-full h-auto drop-shadow-[0_6px_16px_rgba(15,42,80,0.28)]"
      />
    </div>
  );
}
