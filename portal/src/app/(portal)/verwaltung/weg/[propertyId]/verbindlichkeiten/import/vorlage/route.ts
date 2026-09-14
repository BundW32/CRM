import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { buildCsv } from "@/lib/csv";
import { requireVerwalter } from "@/lib/session";
import { VORLAGE_BEISPIEL, VORLAGE_KOPF } from "@/lib/weg/rechnungen-csv";

export const dynamic = "force-dynamic";

/**
 * Vorlage für den Rechnungsimport: Kopfzeile mit den Spaltennamen, die der
 * Import sicher erkennt, und eine Beispielzeile zum Überschreiben. Wer sie in
 * Excel öffnet, füllt sie aus, speichert als CSV und lädt sie hoch — ohne
 * vorher zu raten, wie die Spalten heißen müssen.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const verwalter = await requireVerwalter();
  const { propertyId } = await params;
  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const csv = buildCsv([VORLAGE_KOPF, VORLAGE_BEISPIEL]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Rechnungen-Vorlage.csv"',
    },
  });
}
