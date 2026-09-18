// Gemeinsamer Bauer für die Bescheinigung nach § 35a EStG — eine Seite je
// Einheit. Verwalter- und Eigentümer-Route erzeugen exakt dasselbe Dokument
// aus demselben Abrechnungs-View (Snapshot oder live), wie bei der
// Einzelabrechnung (Nr. 52: kein zweiter Rechen-/Layoutpfad).
import { getBrandingForOrg } from "@/lib/branding-server";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import {
  generateSteuerbescheinigungen,
  type SteuerbescheinigungUnit,
} from "@/lib/documents/steuerbescheinigung";
import { laborDetailAus, laborZeilenFuer } from "./einzelabrechnung-pdf";
import type { StatementView } from "./statement-service";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export async function buildSteuerbescheinigungPdf(args: {
  propertyName: string;
  organizationId: string;
  view: StatementView;
  units: { id: string; label: string }[];
  finalizedAt: Date | null;
}): Promise<Buffer> {
  const { propertyName, organizationId, view, units, finalizedAt } = args;
  const laborDetail = laborDetailAus(view);

  const bescheinigungen: SteuerbescheinigungUnit[] = units.map((u) => {
    const split = view.ownerSplit[u.id];
    const labor = view.labor[u.id];
    return {
      label: u.label,
      owners: (split?.shares ?? []).map((s) => ({ name: s.userName, days: s.days, cents: s.cents })),
      laborRows: laborZeilenFuer(laborDetail, u.id),
      laborHaushaltsnahCents: labor?.haushaltsnah ?? 0,
      laborHandwerkerCents: labor?.handwerker ?? 0,
      laborUnerfasstCents: labor?.unerfasst ?? 0,
    };
  });

  const kopf = await briefkopfAus(await getBrandingForOrg(organizationId));
  const endInclusive = new Date(new Date(view.fyEnd).getTime() - 86400000).toISOString().slice(0, 10);

  return generateSteuerbescheinigungen({
    propertyName,
    issuer: kopf.issuer,
    brand: kopf.brand,
    logo: kopf.logo,
    year: view.year,
    periodLabel: `${fmtDate(view.fyStart)} – ${fmtDate(endInclusive)}`,
    finalizedAt,
    units: bescheinigungen,
    generatedAt: new Date(),
  });
}
