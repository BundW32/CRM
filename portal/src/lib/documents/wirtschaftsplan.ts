// Wirtschaftsplan (§ 28 Abs. 1 WEG): Gesamtplan mit Kostenpositionen,
// Einzelwirtschaftsplänen (monatliches Hausgeld je Einheit) und
// Beschlussvorlage.
//
// Aufgebaut auf lib/documents/kit. Der Bericht hat keinen Empfänger im
// Fensterumschlag — er wird der Einladung beigelegt und abgelegt —, trägt aber
// denselben Kopf, dieselbe Schrift und dieselbe Fußzeile wie die Briefe.
import { formatCents } from "@/lib/money";
import {
  CONTENT_WIDTH,
  Doc,
  color,
  drawReportHead,
  mm,
  size,
  type LetterIssuer,
  type TableCell,
} from "./kit";
import type { RGB } from "pdf-lib";

export type WirtschaftsplanPosition = { name: string; keyLabel: string; amountCents: number };
export type WirtschaftsplanUnit = {
  label: string;
  annualCents: number;
  monthlyMinCents: number;
  monthlyMaxCents: number;
};
export type WirtschaftsplanInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  logoPath?: string | null;
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  positions: WirtschaftsplanPosition[];
  totalCents: number;
  units: WirtschaftsplanUnit[];
  generatedAt: Date;
};

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export async function generateWirtschaftsplan(input: WirtschaftsplanInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Wirtschaftsplan ${input.year} — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Wirtschaftsplan nach § 28 Abs. 1 WEG, ${input.propertyName}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawReportHead(doc, {
    issuer: input.issuer,
    logoPath: input.logoPath,
    title: `Wirtschaftsplan ${input.year}`,
    subtitle: input.propertyName,
    status: input.resolved
      ? {
          text: `Beschlossen am ${fmtDate(input.resolved.date)}${input.resolved.note ? ` (${input.resolved.note})` : ""}`,
          tone: "final",
        }
      : { text: "Entwurf — noch nicht beschlossen", tone: "draft" },
    meta: [
      ["Wirtschaftsjahr", String(input.year)],
      ["Erstellt am", fmtDate(input.generatedAt)],
    ],
  });

  // ── Gesamtwirtschaftsplan ──────────────────────────────────────────────────
  doc.text("Gesamtwirtschaftsplan", {
    size: size.section,
    font: doc.bold,
    color: doc.brand,
    lead: mm(7),
  });
  doc.table(
    [
      { header: "Kostenart", width: 44 },
      { header: "Umlageschlüssel", width: 34 },
      { header: "Planwert / Jahr", width: 22, align: "right" },
    ],
    input.positions.map((p): TableCell[] => [
      { text: p.name },
      { text: p.keyLabel, color: color.muted },
      { text: formatCents(p.amountCents) },
    ]),
  );
  doc.rule({ gapAbove: mm(2), gapBelow: mm(4) });
  doc.amountPanel("Summe Vorschüsse (Hausgeld gesamt)", formatCents(input.totalCents), {
    sub: `Wirtschaftsjahr ${input.year}`,
  });

  // ── Einzelwirtschaftspläne ─────────────────────────────────────────────────
  doc.space(mm(2));
  doc.ensure(mm(30));
  doc.text("Einzelwirtschaftspläne — monatliches Hausgeld je Einheit", {
    size: size.section,
    font: doc.bold,
    color: doc.brand,
    lead: mm(7),
  });
  doc.table(
    [
      { header: "Einheit", width: 44 },
      { header: "Jahres-Vorschuss", width: 28, align: "right" },
      { header: "monatlich", width: 28, align: "right" },
    ],
    input.units.map((u): TableCell[] => [
      { text: u.label },
      { text: formatCents(u.annualCents) },
      {
        text:
          u.monthlyMinCents === u.monthlyMaxCents
            ? formatCents(u.monthlyMaxCents)
            : `${formatCents(u.monthlyMinCents)} – ${formatCents(u.monthlyMaxCents)}`,
      },
    ]),
  );

  // ── Beschlussvorlage ───────────────────────────────────────────────────────
  const vorlage =
    "Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf Grundlage " +
    `des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${input.year} die Vorschüsse zur ` +
    "Kostentragung und zur Zuführung zur Erhaltungsrücklage in Höhe von insgesamt " +
    `${formatCents(input.totalCents)}. Die monatlichen Hausgeld-Vorschüsse je Einheit ergeben ` +
    "sich aus den obigen Einzelwirtschaftsplänen und sind jeweils zum 1. eines Monats fällig.";
  // Überschrift und Vorlage bleiben zusammen — eine Beschlussvorlage, deren
  // Text auf der Folgeseite beginnt, liest in der Versammlung niemand vor.
  doc.space(mm(6));
  doc.ensure(mm(12) + doc.measure(vorlage, { size: size.small, width: CONTENT_WIDTH, lead: mm(4.5) }));
  doc.text("Beschlussvorlage (TOP)", {
    size: size.section,
    font: doc.bold,
    color: doc.brand,
    lead: mm(7),
  });
  doc.para(vorlage, { size: size.small, width: CONTENT_WIDTH, lead: mm(4.5) });

  doc.space(mm(4));
  doc.para("Muster — ersetzt keine Rechtsberatung.", {
    size: size.foot,
    color: color.muted,
    width: CONTENT_WIDTH,
    lead: mm(4),
  });

  return doc.finish({
    left: input.issuer.legalName,
    right: input.resolved
      ? `Wirtschaftsplan ${input.year}`
      : `Wirtschaftsplan ${input.year} (Entwurf)`,
  });
}
