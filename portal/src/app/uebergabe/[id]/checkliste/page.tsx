import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { ChecklisteForm } from "./ChecklisteForm";

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
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={3} title="Checkliste" backHref={`/uebergabe/${id}/raeume`} />
      <ChecklisteForm
        handoverId={id}
        sections={CHECKLIST_SECTIONS}
        saved={saved}
        generalNotes={handover.generalNotes}
        agreements={handover.agreements}
      />
    </div>
  );
}
