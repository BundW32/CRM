// Skeleton-Ladezustand für das (dynamische) Dashboard – vermeidet den leeren
// Sprung beim Datenabruf und signalisiert die Struktur bereits vorab.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Begrüßung */}
      <div className="mb-6 h-8 w-64 rounded-lg bg-white/10" />

      {/* KPI-Reihe */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-e1">
            <div className="mb-3 h-9 w-9 rounded-lg bg-gray-100" />
            <div className="h-8 w-12 rounded bg-gray-100" />
            <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Karten */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 h-4 w-40 rounded bg-gray-100" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3.5 w-52 rounded bg-gray-100" />
                    <div className="h-3 w-36 rounded bg-gray-100" />
                  </div>
                  <div className="h-5 w-16 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-32 rounded bg-gray-100" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
