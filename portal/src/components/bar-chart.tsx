// Schlankes, serverseitig gerendertes Balkendiagramm (reines CSS, keine Chart-
// Lib). Werte als Balken mit Achsenbeschriftung, dezentem Gitter und Leerzustand.
export function BarChart({
  data,
  formatValue,
  barClass = "bg-brand-orange",
}: {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  barClass?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = formatValue ?? ((v: number) => String(v));
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <p className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
        Noch keine Daten für diesen Zeitraum.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="relative flex h-48 items-end gap-1"
        style={{ minWidth: data.length * 40 }}
        role="img"
        aria-label={`Balkendiagramm: ${data.map((d) => `${d.label} ${fmt(d.value)}`).join(", ")}`}
      >
        {/* Dezente Gitterlinien (25/50/75/100 %) hinter den Balken */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block h-px w-full bg-gray-100" />
          ))}
        </div>
        {data.map((d) => (
          <div key={d.label} className="group relative z-10 flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-semibold tabular-nums text-gray-700">{fmt(d.value)}</span>
            <div
              className={`w-full rounded-t transition-opacity ${barClass} group-hover:opacity-80`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${fmt(d.value)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-gray-200 pt-1" style={{ minWidth: data.length * 40 }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 truncate text-center text-[10px] text-gray-500">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
