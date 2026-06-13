// Nachbau des B&W-Logos: orangefarbene Gebäudemarke + dunkelgrüne Wortmarke.
// Reines SVG, damit es überall scharf skaliert (Login, Header, Zugangsschreiben).

const ORANGE = "#f39c1f";
const GREEN = "#13443a";

export function BwBuildingMark({ className = "", size = 48 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 110"
      className={className}
      role="img"
      aria-label="B&W Immobilien Management"
      fill="none"
    >
      {/* linkes Gebäude */}
      <path d="M10 100 V44 L34 30 V100 Z" fill={ORANGE} />
      <rect x="16" y="50" width="3" height="44" fill="#fff" opacity="0.85" />
      <rect x="23" y="46" width="3" height="48" fill="#fff" opacity="0.85" />
      {/* rechtes Gebäude (gespiegelt) */}
      <path d="M110 100 V44 L86 30 V100 Z" fill={ORANGE} />
      <rect x="101" y="50" width="3" height="44" fill="#fff" opacity="0.85" />
      <rect x="94" y="46" width="3" height="48" fill="#fff" opacity="0.85" />
      {/* zentraler Turm */}
      <path d="M44 100 V14 L60 6 L76 14 V100 Z" fill={ORANGE} />
      {/* Fensterreihen im Turm */}
      <g fill="#fff">
        <rect x="50" y="24" width="20" height="4" rx="1" />
        <rect x="50" y="34" width="20" height="4" rx="1" />
        <rect x="50" y="44" width="20" height="4" rx="1" />
        <rect x="50" y="54" width="20" height="4" rx="1" />
        <rect x="50" y="64" width="20" height="4" rx="1" />
        <rect x="50" y="74" width="20" height="4" rx="1" />
        <rect x="50" y="84" width="20" height="4" rx="1" />
      </g>
      {/* Grundlinie */}
      <rect x="4" y="100" width="112" height="7" rx="2" fill={ORANGE} />
    </svg>
  );
}

export function BwLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <BwBuildingMark size={56} />
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-black tracking-tight" style={{ color: GREEN }}>
          B
        </span>
        <span className="text-xl font-semibold" style={{ color: ORANGE }}>
          &amp;
        </span>
        <span className="text-2xl font-black tracking-tight" style={{ color: GREEN }}>
          W
        </span>
      </div>
      <span
        className="text-[9px] font-bold uppercase tracking-[0.22em]"
        style={{ color: GREEN }}
      >
        Immobilien Management
      </span>
    </div>
  );
}

export function BwLogoCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <BwBuildingMark size={34} />
      <span className="flex items-baseline gap-0.5">
        <span className="text-lg font-black tracking-tight" style={{ color: GREEN }}>
          B
        </span>
        <span className="text-sm font-semibold" style={{ color: ORANGE }}>
          &amp;
        </span>
        <span className="text-lg font-black tracking-tight" style={{ color: GREEN }}>
          W
        </span>
        <span
          className="ml-1.5 hidden text-xs font-semibold uppercase tracking-widest sm:inline"
          style={{ color: GREEN }}
        >
          Kundenportal
        </span>
      </span>
    </div>
  );
}
