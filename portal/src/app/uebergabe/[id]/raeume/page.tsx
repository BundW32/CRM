import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { RaeumeClient } from "./RaeumeClient";

export const dynamic = "force-dynamic";

export default async function RaeumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;

  const handover = await db.handover.findUnique({
    where: { id },
    include: {
      rooms: {
        orderBy: { sortOrder: "asc" },
        include: { photos: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!handover) notFound();

  const rooms = handover.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    roomType: r.roomType,
    checks: (r.checks ?? null) as Record<string, string> | null,
    overallNote: r.overallNote,
    photos: r.photos.map((p) => ({
      id: p.id,
      storedName: p.storedName,
      fileName: p.fileName,
      caption: p.caption,
    })),
  }));

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={2} title="Räume" backHref={`/uebergabe/${id}/stammdaten`} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">Raumzustand dokumentieren</h2>
            <p className="text-sm text-white/60">Pro Raum die Prüfpunkte bewerten – je nach Raumart erscheinen passende Punkte (Küche, Bad). Fenster &amp; Türen sind überall dabei.</p>
          </div>
        </div>

        <RaeumeClient handoverId={id} initialRooms={rooms} />

        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href="/uebergabe" className={buttonSecondaryClass}>
            Speichern &amp; schließen
          </Link>
          <Link href={`/uebergabe/${id}/checkliste`} className={buttonClass}>
            Weiter: Checkliste →
          </Link>
        </div>
      </div>
    </div>
  );
}
