export function BwLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-1">
        <span className="text-3xl font-black tracking-tighter text-blue-900">B</span>
        <span className="text-lg font-light text-blue-400">&amp;</span>
        <span className="text-3xl font-black tracking-tighter text-blue-900">W</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700">
        Immobilien Management
      </span>
    </div>
  );
}

export function BwLogoCompact({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-baseline gap-0.5 ${className}`}>
      <span className="text-xl font-black tracking-tighter text-blue-900">B</span>
      <span className="text-sm font-light text-blue-400">&amp;</span>
      <span className="text-xl font-black tracking-tighter text-blue-900">W</span>
      <span className="ml-1.5 text-xs font-semibold uppercase tracking-widest text-blue-700">
        Kundenportal
      </span>
    </div>
  );
}
