import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buttonClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { saveCheckliste } from "./actions";

export const dynamic = "force-dynamic";

const CHECKLIST_SECTIONS = [
  {
    title: "Haustechnik",
    items: [
      { key: "heizung", label: "Heizungsanlage funktioniert" },
      { key: "warmwasser", label: "Warmwasserversorgung funktioniert" },
      { key: "elektrik", label: "Elektrische Anlage in Ordnung" },
      { key: "rauchmelder", label: "Rauchmelder vorhanden und funktionsfähig" },
      { key: "co_melder", label: "CO-Melder vorhanden (falls relevant)" },
    ],
  },
  {
    title: "Küche",
    items: [
      { key: "kueche_einbau", label: "Einbauküche vorhanden und funktionsfähig" },
      { key: "kueche_herd", label: "Herd / Kochfeld funktioniert" },
      { key: "kueche_spuele", label: "Spüle und Armaturen in Ordnung" },
      { key: "kueche_dunstabzug", label: "Dunstabzugshaube funktioniert" },
    ],
  },
  {
    title: "Bad / WC",
    items: [
      { key: "bad_wanne", label: "Badewanne / Dusche in Ordnung" },
      { key: "bad_wc", label: "WC-Spülung funktioniert" },
      { key: "bad_armaturen", label: "Armaturen dicht und funktionsfähig" },
      { key: "bad_abfluss", label: "Abflüsse laufen frei" },
      { key: "bad_schimmel", label: "Keine Schimmelbildung sichtbar" },
    ],
  },
  {
    title: "Fenster & Türen",
    items: [
      { key: "fenster_dicht", label: "Fenster schließen dicht" },
      { key: "fenster_griffe", label: "Fenstergriffe funktionieren" },
      { key: "tueren_schliessen", label: "Türen schließen einwandfrei" },
      { key: "tueren_schloesser", label: "Schlösser funktionieren" },
      { key: "rolllaeden", label: "Rollläden / Jalousien funktionieren" },
    ],
  },
  {
    title: "Wände, Böden & Decken",
    items: [
      { key: "waende_ok", label: "Wände ohne Risse oder Schäden" },
      { key: "boden_ok", label: "Bodenbelag ohne Beschädigungen" },
      { key: "decke_ok", label: "Decken ohne Feuchtigkeitsflecken" },
    ],
  },
  {
    title: "Sonstiges",
    items: [
      { key: "keller_ok", label: "Kellerabteil vorhanden und übergeben" },
      { key: "garage_ok", label: "Garage / Stellplatz übergeben" },
      { key: "briefkasten", label: "Briefkasten beschriftet" },
      { key: "benutzungshinweise", label: "Einweisungen / Bedienungsanleitungen übergeben" },
      { key: "muell", label: "Wohnung besenrein übergeben" },
    ],
  },
];

const STATE_OPTIONS = [
  { value: "ok", label: "In Ordnung", color: "text-green-600" },
  { value: "maengel", label: "Mängel", color: "text-yellow-600" },
  { value: "na", label: "Nicht vorhanden", color: "text-gray-400" },
];

export default async function ChecklistePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({ where: { id } });
  if (!handover) notFound();

  const saved = (handover.checklist ?? {}) as Record<string, string>;

  return (
    <div className="pb-10">
      <StepHeader currentStep={3} title="Checkliste" backHref={`/uebergabe/${id}/raeume`} />

      <div className="mx-auto max-w-2xl px-4 pt-6">
        <form action={saveCheckliste} className="space-y-5">
          <input type="hidden" name="id" value={id} />

          {CHECKLIST_SECTIONS.map((section) => (
            <div key={section.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">{section.title}</h2>
              <div className="divide-y divide-gray-100">
                {section.items.map((item) => {
                  const current = saved[item.key] ?? "";
                  return (
                    <div key={item.key} className="py-3 flex items-center justify-between gap-4">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <div className="flex gap-2 shrink-0">
                        {STATE_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`flex items-center gap-1 cursor-pointer text-xs font-medium ${opt.color}`}>
                            <input
                              type="radio"
                              name={`check_${item.key}`}
                              value={opt.value}
                              defaultChecked={current === opt.value}
                              className="accent-brand-orange"
                            />
                            <span className="hidden sm:inline">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Allgemeine Anmerkungen */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Anmerkungen &amp; Vereinbarungen</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allgemeine Anmerkungen</label>
              <textarea
                name="generalNotes"
                defaultValue={handover.generalNotes ?? ""}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                placeholder="Weitere Bemerkungen zum Zustand der Wohnung …"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Getroffene Vereinbarungen</label>
              <textarea
                name="agreements"
                defaultValue={handover.agreements ?? ""}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                placeholder="z. B. Mieter streicht Wand bis 01.07. neu …"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className={buttonClass}>
              Weiter: Zählerstände →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
