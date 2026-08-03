import { notFound } from "next/navigation";
import { Card, cardSurfaceClass } from "@/components/ui";
import { Badge } from "@/components/data-display";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import {
  ALL_ROOM_CHECK_LABELS,
  GENERAL_CHECKLIST_LABELS,
  checksForRoomType,
} from "@/lib/handover-checks";
import { SignatureSection } from "./SignatureSection";

export const dynamic = "force-dynamic";

const typeLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Zwischenzustand" };
const moveDateLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Stichtag" };

function fmt(d: Date | null): string {
  return d
    ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
}

export default async function UnterschriftenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { id } = await params;
  if (!(await canVerwalterAccessHandover(verwalter, id))) notFound();

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

  const checklist = (handover.checklist ?? {}) as Record<string, string>;
  const maengelItems = Object.entries(checklist)
    .filter(([k, v]) => !k.startsWith("note_") && v === "maengel")
    .map(([k]) => GENERAL_CHECKLIST_LABELS[k] ?? k);

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={5} backHref={`/uebergabe/${id}/zaehler`} handoverId={id} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-4">
        {/* Header summary */}
        <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 space-y-1">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><strong className="text-white">Typ:</strong> {typeLabels[handover.type]}</span>
            <span><strong className="text-white">Protokoll:</strong> {fmt(handover.handoverDate)}</span>
            <span><strong className="text-white">{moveDateLabels[handover.type]}:</strong> {fmt(handover.moveDate)}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span><strong className="text-white">Einheit:</strong> {handover.unit.property.name} · {handover.unit.label}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {handover.tenantName && <span><strong className="text-white">Mieter:</strong> {handover.tenantName}</span>}
            {handover.tenant2Name && <span><strong className="text-white">2. Mieter:</strong> {handover.tenant2Name}</span>}
            {handover.ownerName && <span><strong className="text-white">Eigentümer:</strong> {handover.ownerName}</span>}
            {handover.managerName && <span><strong className="text-white">Protokollführer:</strong> {handover.managerName}</span>}
          </div>
        </div>

        {/* Room summary */}
        {handover.rooms.length > 0 && (
          <Card
            title={
              <span className="flex items-center gap-2">
                Räume
                <Badge tone="neutral">{handover.rooms.length}</Badge>
              </span>
            }
          >
            <div className="divide-y divide-gray-100">
              {handover.rooms.map((room) => {
                const checks = (room.checks ?? {}) as Record<string, string>;
                const points = checksForRoomType(room.roomType);
                const maengel = points.filter((p) => checks[p.key] === "maengel");
                const notes = points
                  .map((p) => ({ label: p.label, note: checks[`note_${p.key}`] }))
                  .filter((n) => n.note);
                const hasFindings = maengel.length > 0 || notes.length > 0 || !!room.overallNote;
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
                        {maengel.length > 0 ? (
                          <span className="rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-yellow-700 font-medium">
                            {maengel.length} {maengel.length === 1 ? "Mangel" : "Mängel"}
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-green-600 font-medium">OK</span>
                        )}
                      </div>
                    </div>
                    {hasFindings && (
                      <div className="mt-1.5 space-y-0.5">
                        {maengel.map((p) => (
                          <p key={p.key} className="text-xs text-yellow-700">
                            <span className="font-medium">Mangel:</span> {ALL_ROOM_CHECK_LABELS[p.key] ?? p.label}
                            {checks[`note_${p.key}`] ? ` – ${checks[`note_${p.key}`]}` : ""}
                          </p>
                        ))}
                        {notes
                          .filter((n) => !maengel.some((m) => m.label === n.label))
                          .map((n) => (
                            <p key={n.label} className="text-xs text-gray-500">
                              <span className="font-medium text-gray-600">{n.label}:</span> {n.note}
                            </p>
                          ))}
                        {room.overallNote && (
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">Anmerkung:</span> {room.overallNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Checklist Mängel summary */}
        {maengelItems.length > 0 && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 space-y-1.5">
            <p className="text-sm font-semibold text-yellow-800">
              Checkliste: {maengelItems.length} {maengelItems.length === 1 ? "Mangel" : "Mängel"} festgestellt
            </p>
            <div className="flex flex-wrap gap-1.5">
              {maengelItems.map((label) => (
                <Badge key={label} tone="warning">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Meters summary */}
        {handover.meters.length > 0 && (
          <div className={`px-4 py-3 ${cardSurfaceClass}`}>
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
          tenant2Name={handover.tenant2Name}
          managerName={handover.managerName}
          managerCompany={handover.managerCompany}
          initialTenantSig={handover.tenantSignature}
          initialTenant2Sig={handover.tenant2Signature}
          initialManagerSig={handover.managerSignature}
        />
      </div>
    </div>
  );
}
