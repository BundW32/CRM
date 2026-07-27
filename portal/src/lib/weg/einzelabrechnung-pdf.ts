// Gemeinsamer Bauer für die Einzelabrechnungen (§ 28 Abs. 2 WEG).
//
// Derselbe Aufbau stand bisher zweimal fast wortgleich in den PDF-Routen von
// Verwalter und Eigentümer; mit der automatischen Ablage wäre er ein drittes
// Mal entstanden. Drei Kopien einer Zuordnung, bei der ein vergessenes Feld
// dazu führt, dass ein Eigentümer eine andere Zahl sieht als der Verwalter.
import { getBrandingForOrg } from "@/lib/branding-server";
import { distributionKeyLabels } from "@/lib/labels";
import {
  generateEinzelabrechnungen,
  type EinzelabrechnungUnit,
} from "@/lib/documents/einzelabrechnung";
import type { StatementView } from "./statement-service";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Baut die Einzelabrechnungen — für alle übergebenen Einheiten, eine Seite je Einheit. */
export async function buildEinzelabrechnungPdf(args: {
  propertyName: string;
  organizationId: string;
  view: StatementView;
  units: { id: string; label: string }[];
  finalizedAt: Date | null;
}): Promise<Buffer> {
  const { propertyName, organizationId, view, units, finalizedAt } = args;

  const abrechnungsEinheiten: EinzelabrechnungUnit[] = units.map((u) => {
    const split = view.ownerSplit[u.id];
    const labor = view.labor[u.id];
    return {
      label: u.label,
      owners: (split?.shares ?? []).map((s) => ({
        name: s.userName,
        days: s.days,
        cents: s.cents,
      })),
      uncoveredCents: split?.uncoveredCents ?? 0,
      costRows: view.rows
        .filter((r) => r.perUnit)
        .map((r) => ({
          name: r.name,
          keyLabel: distributionKeyLabels[r.distributionKey] ?? r.distributionKey,
          totalCents: r.totalCents,
          shareCents: r.perUnit![u.id] ?? 0,
        })),
      kostenanteilCents: view.perUnitTotal[u.id] ?? 0,
      sollCents: view.duePerUnit[u.id] ?? 0,
      peakCents: view.peak[u.id] ?? 0,
      laborHaushaltsnahCents: labor?.haushaltsnah ?? 0,
      laborHandwerkerCents: labor?.handwerker ?? 0,
    };
  });

  const branding = await getBrandingForOrg(organizationId);
  const endInclusive = new Date(new Date(view.fyEnd).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);

  return generateEinzelabrechnungen({
    propertyName,
    issuer: {
      legalName: branding.legalName,
      contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
    },
    year: view.year,
    periodLabel: `${fmtDate(view.fyStart)} – ${fmtDate(endInclusive)}`,
    finalizedAt,
    units: abrechnungsEinheiten,
    generatedAt: new Date(),
  });
}
