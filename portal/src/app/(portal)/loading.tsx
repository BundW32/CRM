import { cardSurfaceClass } from "@/components/ui";
export default function PortalLoading() {
  return (
    <div className="animate-fade-in">
      {/* Simuliert PageTitle */}
      <div className="mb-6 h-9 w-48 rounded-lg bg-white/10 animate-pulse" />

      {/* Simuliert Card-Reihe */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className={`space-y-3 p-5 ${cardSurfaceClass}`}>
            <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t border-gray-100">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-56 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-40 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className={`space-y-3 p-5 ${cardSurfaceClass}`}>
          <div className="h-4 w-28 rounded bg-gray-100 animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 pt-2 border-t border-gray-100">
              <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
