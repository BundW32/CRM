import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { SignatureSection } from "./SignatureSection";

export const dynamic = "force-dynamic";

const typeLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Zwischenzustand" };

const ROOM_NOTE_LABELS: { key: string; label: string }[] = [
  { key: "overallNote", label: "Allgemeiner Zustand" },
  { key: "wallsNote", label: "Wände" },
  { key: "ceilingNote", label: "Decke" },
  { key: "floorNote", label: "Boden" },
  { key: "windowsNote", label: "Fenster" },
  { key: "doorsNote", label: "Türen" },
  { key: "heatingNote", label: "Heizung" },
  { key: "sanitaryNote", label: "Sanitär" },
  { key: "otherNote", label: "Sonstiges" },
];

const CHECKLIST_LABELS: Record<string, string> = {
  heizung: "Heizungsanlage",
  warmwasser: "Warmwasser",
  elektrik: "Elektrik",
  rauchmelder: "Rauchmelder",
  co_melder: "CO-Melder",
  kueche_einbau: "Einbauküche",
  kueche_herd: "Herd/Kochfeld",
  kueche_spuele: "Spüle",
  kueche_dunstabzug: "Dunstabzug",
  bad_wanne: "Wanne/Dusche",
  bad_wc: "WC-Spülung",
  bad_armaturen: "Armaturen",
  bad_abfluss: "Abflüsse",
  bad_schimmel: "Schimmel",
  fenster_dicht: "Fenster dicht",
  fenster_griffe: "Fenstergriffe",
  tueren_schliessen: "Türen",
  tueren_schloesser: "Schlösser",
  rolllaeden: "Rollläden",
  waende_ok: "Wände",
  boden_ok: "Boden",
  decke_ok: "Decken",
  keller_ok: "Kellerabteil",
  garage_ok: "Garage",
  briefkasten: "Briefkasten",
  benutzungshinweise: "Einweisungen",
  muell: "Besenrein",
};

export default async function UnterschriftenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({
    where: { id },
    include: {
      unit: { include: { property: true } },
      rooms: {
        include: { photos: { select: { id: true } } },
        orderBy: { sortOrder: "asc" },
      },
      meters: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!handover) notFound();

  const dateFormatted = handover.handoverDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const checklist = (handover.checklist ?? {}) as Record<string, string>;
  const maengelItems = Object.entries(checklist)
    .filter(([k, v]) => !k.startsWith("note_") && v === "maengel")
    .map(([k]) => CHECKLIST_LABELS[k] ?? k);

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={5} title="Unterschriften" backHref={`/uebergabe/${id}/zaehler`} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-4">
        {/* Header summary */}
        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 space-y-1">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><strong className="text-white">Typ:</strong> {typeLabels[handover.type]}</span>
            <span><strong className="text-white">Datum:</strong> {dateFormatted}</span>
            <span><strong className="text-white">Einheit:</strong> {handover.unit.property.name} · {handover.unit.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {handover.tenantName && <span><strong className="text-white">Mieter:</strong> {handover.tenantName}</span>}
            {handover.ownerName && <span><strong className="text-white">Eigentümer:</strong> {handover.ownerName}</span>}
            {handover.managerName && <span><strong className="text-white">Protokoll:</strong> {handover.managerName}</span>}
          </div>
        </div>

        {/* Room summary */}
        {handover.rooms.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              Räume
              <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {handover.rooms.length}
              </span>
            </h2>
            <div className="divide-y divide-gray-100">
              {handover.rooms.map((room) => {
                const notes = ROOM_NOTE_LABELS.filter(
                  (n) => (room as Record<string, unknown>)[n.key]
                );
                const hasNotes = notes.length > 0;
                return (
                  <div key={room.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-gray-800">{room.name}</span>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                        {room.photos.length > 0 && (
                          <span className="flex items-center gap-1">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="m21 15-5-5L5 21" />
                            </svg>
                            {room.photos.length}
                          </span>
                        )}
                        {!hasNotes && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-600 font-medium">
                            OK
                          </span>
                        )}
                      </div>
                    </div>
                    {hasNotes && (
                      <div className="mt-1.5 space-y-0.5">
                        {notes.map((n) => (
                          <p key={n.key} className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">{n.label}:</span>{" "}
                            {String((room as Record<string, unknown>)[n.key])}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Checklist Mängel summary */}
        {maengelItems.length > 0 && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 space-y-1.5">
            <p className="text-sm font-semibold text-yellow-800">
              Checkliste: {maengelItems.length} Mängel festgestellt
            </p>
            <div className="flex flex-wrap gap-1.5">
              {maengelItems.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full bg-yellow-100 border border-yellow-200 px-2.5 py-0.5 text-xs font-medium text-yellow-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meters summary */}
        {handover.meters.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Zähler ({handover.meters.length})
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {handover.meters.map((m) => (
                <span key={m.id} className="text-xs text-gray-600">
                  <span className="font-medium">{m.meterType.replace(/_/g, " ")}:</span>{" "}
                  {m.reading ?? "—"}
                </span>
              ))}
            </div>
          </div>
        )}

        <SignatureSection
          handoverId={id}
          tenantName={handover.tenantName}
          managerName={handover.managerName}
          initialTenantSig={handover.tenantSignature}
          initialManagerSig={handover.managerSignature}
        />
      </div>
    </div>
  );
}
