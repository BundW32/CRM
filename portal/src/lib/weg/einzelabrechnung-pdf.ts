// Gemeinsamer Bauer für die Einzelabrechnungen (§ 28 Abs. 2 WEG).
//
// Derselbe Aufbau stand bisher zweimal fast wortgleich in den PDF-Routen von
// Verwalter und Eigentümer; mit der automatischen Ablage wäre er ein drittes
// Mal entstanden. Drei Kopien einer Zuordnung, bei der ein vergessenes Feld
// dazu führt, dass ein Eigentümer eine andere Zahl sieht als der Verwalter.
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { statementKeyLabels } from "@/lib/labels";
import {
  generateEinzelabrechnungen,
  type EinzelabrechnungUnit,
} from "@/lib/documents/einzelabrechnung";
import type { StatementView } from "./statement-service";
import { baueUmlagebasis, schluesselMitAnteil, umlagebasisZeilen, type Umlagebasis } from "./umlagebasis";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Snapshots aus der Zeit vor der Umlagebasis tragen keine Bezugsgrößen. Dann
 * zählen die Stammdaten von heute — das sind fast immer dieselben, und ohne
 * sie stünde in der Abrechnung wieder nur der Name des Schlüssels.
 */
async function umlagebasisAusStammdaten(propertyId: string): Promise<Umlagebasis> {
  const units = await db.unit.findMany({
    where: { propertyId },
    select: { id: true, label: true, mea: true, livingArea: true, personCount: true, unitType: true },
  });
  return baueUmlagebasis(units);
}

/** Baut die Einzelabrechnungen — für alle übergebenen Einheiten, eine Seite je Einheit. */
export async function buildEinzelabrechnungPdf(args: {
  propertyName: string;
  /** Für die Bezugsgrößen, wenn der Snapshot sie noch nicht trägt. */
  propertyId: string;
  organizationId: string;
  view: StatementView;
  units: { id: string; label: string }[];
  finalizedAt: Date | null;
}): Promise<Buffer> {
  const { propertyName, propertyId, organizationId, view, units, finalizedAt } = args;
  const basis = view.umlagebasis ?? (await umlagebasisAusStammdaten(propertyId));

  const abrechnungsEinheiten: EinzelabrechnungUnit[] = units.map((u) => {
    const split = view.ownerSplit[u.id];
    const labor = view.labor[u.id];
    const verteilt = view.rows.filter((r) => r.perUnit);
    // Nur Positionen, an denen diese Einheit beteiligt ist. Bei Schlüsseln, die
    // das Portal selbst verteilt, ist das jede Einheit; bei der Verteilung von
    // Hand nur die, für die ein Betrag erfasst wurde — auch „0,00" zählt als
    // beteiligt. Was für die Einheit nicht erfasst ist, gehört nicht auf ihre
    // Abrechnung: Die anderen Eigentümer sehen sonst den Gaskamin des
    // Nachbarn mit „Ihr Anteil 0,00 €". Alte Snapshots tragen für jede Einheit
    // einen Eintrag und rendern deshalb unverändert.
    const beteiligt = verteilt.filter((r) => u.id in r.perUnit!);
    return {
      label: u.label,
      owners: (split?.shares ?? []).map((s) => ({
        name: s.userName,
        days: s.days,
        cents: s.cents,
      })),
      uncoveredCents: split?.uncoveredCents ?? 0,
      umlagebasis: umlagebasisZeilen(verteilt, basis, u.id),
      costRows: beteiligt.map((r) => ({
        name: r.name,
        keyLabel: schluesselMitAnteil(
          statementKeyLabels[r.distributionKey] ?? r.distributionKey,
          r,
          basis,
          u.id,
        ),
        totalCents: r.totalCents,
        shareCents: r.perUnit![u.id] ?? 0,
      })),
      nichtBeteiligt: verteilt.length - beteiligt.length,
      kostenanteilCents: view.perUnitTotal[u.id] ?? 0,
      sollCents: view.duePerUnit[u.id] ?? 0,
      peakCents: view.peak[u.id] ?? 0,
      laborHaushaltsnahCents: labor?.haushaltsnah ?? 0,
      laborHandwerkerCents: labor?.handwerker ?? 0,
      laborUnerfasstCents: labor?.unerfasst ?? 0,
    };
  });

  const kopf = await briefkopfAus(await getBrandingForOrg(organizationId));
  const endInclusive = new Date(new Date(view.fyEnd).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);

  return generateEinzelabrechnungen({
    propertyName,
    issuer: kopf.issuer,
    brand: kopf.brand,
    logo: kopf.logo,
    year: view.year,
    periodLabel: `${fmtDate(view.fyStart)} – ${fmtDate(endInclusive)}`,
    finalizedAt,
    units: abrechnungsEinheiten,
    generatedAt: new Date(),
  });
}
