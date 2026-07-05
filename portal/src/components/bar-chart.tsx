// Schlankes, serverseitig gerendertes Balkendiagramm (reines CSS, keine Chart-
// Lib). Werte als Balken mit Achsenbeschriftung; optional Werteformatierung.
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

  return (
    <div className="overflow-x-auto">
      <div className="flex h-48 items-end gap-1" style={{ minWidth: data.length * 40 }}>
        {data.map((d) => (
          <div key={d.label} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-medium text-gray-700">{fmt(d.value)}</span>
            <div
              className={`w-full rounded-t ${barClass}`}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
              title={`${d.label}: ${fmt(d.value)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1" style={{ minWidth: data.length * 40 }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 truncate text-center text-[10px] text-gray-400">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
