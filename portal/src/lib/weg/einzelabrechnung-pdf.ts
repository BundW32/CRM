// Gemeinsamer Bauer für die Einzelabrechnungen (§ 28 Abs. 2 WEG).
//
// Derselbe Aufbau stand bisher zweimal fast wortgleich in den PDF-Routen von
// Verwalter und Eigentümer; mit der automatischen Ablage wäre er ein drittes
// Mal entstanden. Drei Kopien einer Zuordnung, bei der ein vergessenes Feld
// dazu führt, dass ein Eigentümer eine andere Zahl sieht als der Verwalter.
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import {
  generateEinzelabrechnungen,
  type EinzelabrechnungLaborRow,
  type EinzelabrechnungUnit,
} from "@/lib/documents/einzelabrechnung";
import { computeLaborDetail, type LaborDetailRow } from "./annual-statement";
import type { StatementView } from "./statement-service";
import { baueUmlagebasis, umlagebasisZeilen, type Umlagebasis } from "./umlagebasis";
import { umlageschluesselText } from "./umlageschluessel-text";

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

/**
 * § 35a je Kostenart und Einheit. Seit 18.09.2026 im Snapshot; ältere
 * Snapshots tragen nur die Summen — dann wird die Aufstellung aus den Zeilen
 * nachgerechnet, mit derselben Funktion, die auch die Summen gebildet hat.
 */
export function laborDetailAus(view: StatementView): Record<string, LaborDetailRow[]> {
  if (view.laborDetail) return view.laborDetail;
  return Object.fromEntries(
    computeLaborDetail(
      view.rows.map((r) => ({
        ...r,
        perUnit: r.perUnit ? new Map(Object.entries(r.perUnit)) : null,
      })),
    ),
  );
}

export function laborZeilenFuer(detail: Record<string, LaborDetailRow[]>, unitId: string): EinzelabrechnungLaborRow[] {
  return (detail[unitId] ?? [])
    .filter((r) => r.anteilCents > 0)
    .map((r) => ({
      name: r.name,
      keyLabel: umlageschluesselText(r),
      art: r.art,
      gesamtCents: r.gesamtCents,
      anteilCents: r.anteilCents,
    }));
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
  const laborDetail = laborDetailAus(view);

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
      // Schlüsselspalte nur mit dem Namen des Schlüssels: Zähler und Nenner
      // stehen im Block „Grundlage der Verteilung" darüber; in jeder Zeile
      // wiederholt machten sie die Tabelle unübersichtlich (Kundenwunsch).
      // Heizkosten behalten den HeizkostenV-Text.
      costRows: beteiligt.map((r) => ({
        name: r.name,
        keyLabel: umlageschluesselText(r),
        totalCents: r.totalCents,
        shareCents: r.perUnit![u.id] ?? 0,
        recoverable: r.recoverableBetrKV,
      })),
      laborRows: laborZeilenFuer(laborDetail, u.id),
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
