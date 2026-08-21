"use client";

// OWNER: UI · Refined Hero illustration: autonomous agent robot presents payment intent,
// WARDEN guard verifies with shield (green checkmark) and blocks rouge spend (red node).
// Clean transparent vector SVG with no background, halo, or raster artifacts.

export function WardenIllustration({ className = "w-full max-w-2xl h-auto" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 960 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
        </defs>

        {/* 1. BASELINE GROUND */}
        <g stroke="#334155" strokeWidth="5" strokeLinecap="round" opacity="0.8">
          <line x1="70" y1="365" x2="95" y2="365" />
          <line x1="115" y1="365" x2="860" y2="365" />
          <line x1="880" y1="365" x2="905" y2="365" />
        </g>

        {/* 2. TRANSACTION DATA STREAM */}
        <g>
          <line x1="390" y1="250" x2="455" y2="250" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 15" />
          <circle cx="465" cy="250" r="10" fill="#ffffff" stroke="#3b82f6" strokeWidth="5.5" />
          <line x1="478" y1="250" x2="650" y2="250" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 15" />
          <line x1="755" y1="250" x2="815" y2="250" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 15" />
          <circle cx="835" cy="250" r="14" fill="#ef4444" stroke="#1e293b" strokeWidth="5" />
        </g>

        {/* 3. LEFT CHARACTER: ROBOT */}
        <g id="robot-character">
          <path
            d="M205 235 C185 240 160 280 150 315 C145 330 155 345 170 345 C185 345 195 330 205 305 L218 255"
            fill="#fdfefe"
            stroke="#1e293b"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path
            d="M218 225 L210 330 C210 345 220 355 240 355 L265 355 C285 355 295 345 292 330 L288 225 Z"
            fill="#fdfefe"
            stroke="#1e293b"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path d="M228 235 L242 350" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" />

          {/* Robot Ear */}
          <rect x="165" y="150" width="18" height="34" rx="8" fill="url(#blueGrad)" stroke="#1e293b" strokeWidth="5" />
          <path d="M183 158 L192 158" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
          <path d="M183 176 L192 176" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />

          {/* Robot Head */}
          <rect
            x="180"
            y="110"
            width="135"
            height="105"
            rx="32"
            fill="#fdfefe"
            stroke="#1e293b"
            strokeWidth="5.5"
          />
          <ellipse cx="245" cy="160" rx="5.5" ry="7" fill="#1e293b" />
          <ellipse cx="295" cy="160" rx="5.5" ry="7" fill="#1e293b" />
          <path d="M260 176 Q270 186 280 176" stroke="#1e293b" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <rect x="238" y="215" width="28" height="10" rx="4" fill="#cbd5e1" stroke="#1e293b" strokeWidth="4.5" />

          {/* Robot Right Arm & Card */}
          <path
            d="M285 240 C310 245 330 260 360 270 C365 272 375 265 372 258 L355 242 C335 228 310 226 285 232"
            fill="#fdfefe"
            stroke="#1e293b"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <ellipse cx="366" cy="265" rx="8" ry="10" fill="#fdfefe" stroke="#1e293b" strokeWidth="5" />

          <g transform="translate(362, 222)">
            <line x1="-5" y1="-8" x2="-14" y2="-18" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="17" y1="-12" x2="17" y2="-25" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="39" y1="-8" x2="48" y2="-18" stroke="#3b82f6" strokeWidth="4.5" strokeLinecap="round" />
            <rect
              x="0"
              y="0"
              width="34"
              height="50"
              rx="7"
              fill="url(#cardGrad)"
              stroke="#1e293b"
              strokeWidth="5"
            />
            <path d="M17 14 L26 25 L17 31 L8 25 Z" fill="#94a3b8" opacity="0.6" />
            <path d="M17 14 L26 25 L17 21 Z" fill="#64748b" />
            <path d="M17 14 L8 25 L17 21 Z" fill="#cbd5e1" />
            <path d="M17 23 L26 25 L17 36 L8 25 Z" fill="#94a3b8" opacity="0.8" />
            <path d="M17 23 L26 25 L17 36 Z" fill="#475569" />
            <path d="M17 23 L8 25 L17 36 Z" fill="#94a3b8" />
          </g>
        </g>

        {/* 4. RIGHT CHARACTER: WARDEN GUARD */}
        <g id="warden-guard">
          <path
            d="M592 205 C570 230 550 255 570 290 C578 302 592 290 598 280 L610 235"
            fill="#e2e8f0"
            stroke="#1e293b"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path d="M608 300 L600 365 L636 365 L644 300 Z" fill="#e2e8f0" stroke="#1e293b" strokeWidth="5" strokeLinejoin="round" />
          <path d="M650 300 L658 365 L694 365 L686 300 Z" fill="#e2e8f0" stroke="#1e293b" strokeWidth="5" strokeLinejoin="round" />
          <path d="M588 365 C588 355 600 348 618 348 L640 348 C645 348 645 365 645 365 Z" fill="#1e293b" stroke="#1e293b" strokeWidth="3" />
          <path d="M655 365 C655 348 655 348 660 348 L682 348 C700 348 712 355 712 365 Z" fill="#1e293b" stroke="#1e293b" strokeWidth="3" />
          <path
            d="M600 200 L592 300 L702 300 L694 200 Z"
            fill="#e2e8f0"
            stroke="#1e293b"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path d="M625 195 L647 225 L669 195" fill="#cbd5e1" stroke="#1e293b" strokeWidth="4.5" strokeLinejoin="round" />
          <line x1="647" y1="225" x2="647" y2="300" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
          <path d="M612 235 L628 235" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

          {/* Epaulets */}
          <path d="M590 205 L615 195 L618 205 L594 216 Z" fill="#2563eb" stroke="#1e293b" strokeWidth="4.5" strokeLinejoin="round" />
          <path d="M704 205 L679 195 L676 205 L700 216 Z" fill="#2563eb" stroke="#1e293b" strokeWidth="4.5" strokeLinejoin="round" />

          {/* Belt */}
          <rect x="590" y="285" width="114" height="18" fill="#1e293b" />
          <rect x="635" y="282" width="24" height="24" rx="4" fill="#2563eb" stroke="#1e293b" strokeWidth="4" />

          {/* Head & Face */}
          <path
            d="M608 140 C608 110 630 85 660 85 C690 85 712 110 712 140 C712 175 685 195 660 195 C635 195 608 175 608 140 Z"
            fill="#fdfefe"
            stroke="#1e293b"
            strokeWidth="5.5"
          />
          <ellipse cx="638" cy="150" rx="5" ry="6.5" fill="#1e293b" />
          <ellipse cx="678" cy="150" rx="5" ry="6.5" fill="#1e293b" />
          <path d="M650 166 Q658 174 666 166" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" fill="none" />
          <rect x="708" y="138" width="14" height="26" rx="6" fill="#fdfefe" stroke="#1e293b" strokeWidth="4.5" />

          {/* Cap */}
          <path
            d="M608 128 C606 72 714 72 712 128 Z"
            fill="#cbd5e1"
            stroke="#1e293b"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M594 135 C615 118 705 118 726 135 C715 142 605 142 594 135 Z"
            fill="#1e293b"
            stroke="#1e293b"
            strokeWidth="3"
          />
          <path
            d="M652 98 L668 98 L668 110 C668 118 660 123 660 123 C660 123 652 118 652 110 Z"
            fill="#2563eb"
            stroke="#1e293b"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Right Arm */}
          <path
            d="M685 205 C705 215 725 240 710 270"
            stroke="#1e293b"
            strokeWidth="5.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* 5. SHIELD */}
          <g id="warden-shield" transform="translate(660, 180)">
            <path
              d="M0 25 C30 10 95 10 125 25 C128 75 125 140 62 175 C0 140 -3 75 0 25 Z"
              fill="url(#shieldBorder)"
              stroke="#1e293b"
              strokeWidth="5.5"
              strokeLinejoin="round"
            />
            <path
              d="M10 32 C35 20 90 20 115 32 C118 75 115 130 62 162 C10 130 7 75 10 32 Z"
              fill="url(#shieldGrad)"
              stroke="#1e293b"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            <path
              d="M18 38 C38 28 62 28 62 28 L62 152 C22 124 16 78 18 38 Z"
              fill="#ffffff"
              opacity="0.6"
            />
            <path
              d="M38 88 L54 105 L88 64"
              stroke="#10b981"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}

