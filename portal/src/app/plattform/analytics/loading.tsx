import { cardSurfaceClass } from "@/components/ui";

// Skeleton beim Wechsel zwischen den Analytics-Seiten: Titel, Unter-
// Navigation, Filterleiste und zwei Karten — dieselbe Grundform wie die
// Seiten selbst, damit nichts springt.
export default function AnalyticsLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 h-9 w-48 animate-pulse rounded-lg bg-white/10" />
      <div className={`${cardSurfaceClass} mb-4 h-11 animate-pulse`} />
      <div className={`${cardSurfaceClass} mb-5 h-14 animate-pulse`} />
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`space-y-3 p-5 ${cardSurfaceClass}`}>
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
