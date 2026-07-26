import { propertyWhereForVerwalter } from "@/lib/access";
import { PendingButton } from "@/components/pending-button";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buttonClass, inputClass } from "@/components/ui";
import { createHandover } from "./actions";
import { PropertyUnitSelector } from "./PropertyUnitSelector";

export const dynamic = "force-dynamic";

export default async function NeueUebergabePage() {
  const verwalter = await requireVerwalter();
  const propWhere = await propertyWhereForVerwalter(verwalter);

  const properties = await db.property.findMany({
    where: { ...propWhere, units: { some: {} } },
    include: { units: { orderBy: { label: "asc" }, select: { id: true, label: true, floor: true } } },
    orderBy: { name: "asc" },
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bw-shell-bg flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-xl animate-page-in">
        <div className="mb-5">
          <a
            href="/verwaltung"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zurück zur Verwaltung
          </a>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Neue Übergabe anlegen</h1>
          <p className="text-sm text-gray-500 mb-6">Wählen Sie die Einheit und Art der Übergabe.</p>

          <form action={createHandover} className="space-y-5">
            <PropertyUnitSelector properties={properties} />

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Übergabeart</span>

              <div className="flex flex-wrap gap-4">
                {[
                  { value: "EINZUG", label: "Einzug" },
                  { value: "AUSZUG", label: "Auszug" },
                  { value: "ZWISCHENZUSTAND", label: "Zwischenzustand" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      defaultChecked={opt.value === "EINZUG"}
                      className="accent-brand-orange"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Protokolldatum</label>
              <input
                type="date"
                name="handoverDate"
                defaultValue={today}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">Ein- bzw. Auszugsdatum legen Sie im nächsten Schritt fest.</p>
            </div>

            <div className="pt-2">
              <PendingButton className={buttonClass}>Protokoll erstellen →</PendingButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
