// Wirtschaftsplan (§ 28 Abs. 1 WEG): Gesamtplan mit Kostenpositionen,
// Einzelwirtschaftsplänen (monatliches Hausgeld je Einheit) und
// Beschlussvorlage.
//
// Aufgebaut auf lib/documents/kit. Der Bericht hat keinen Empfänger im
// Fensterumschlag — er wird der Einladung beigelegt und abgelegt —, trägt aber
// denselben Kopf, dieselbe Schrift und dieselbe Fußzeile wie die Briefe.
import type { HausgeldRounding } from "@/generated/prisma/client";
import { hausgeldRoundingLabels } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import type { Monatsraten } from "@/lib/weg/economic-plan";
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
  /** Jahresvorschuss, zwölf Monatsraten und die Überdeckung der Rundung. */
  raten: Monatsraten;
};
export type WirtschaftsplanInput = {
  propertyName: string;
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  year: number;
  resolved: { date: Date; note: string | null } | null; // null = Entwurf
  positions: WirtschaftsplanPosition[];
  totalCents: number;
  units: WirtschaftsplanUnit[];
  /** Rundungsstufe der Monatsraten (Einstellung des Objekts, beim Beschluss festgeschrieben). */
  rounding?: HausgeldRounding;
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
    logo: input.logo,
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
      { header: "Einheit", width: 34 },
      { header: "Jahres-Vorschuss", width: 22, align: "right" },
      { header: "monatlich", width: 22, align: "right" },
      { header: "12 Raten =", width: 22, align: "right" },
    ],
    input.units.map((u): TableCell[] => {
      const min = Math.min(...u.raten.rates);
      const max = Math.max(...u.raten.rates);
      return [
        { text: u.label },
        { text: formatCents(u.raten.annualCents) },
        { text: min === max ? formatCents(max) : `${formatCents(min)} – ${formatCents(max)}` },
        // Die vierte Spalte ist der Punkt, an dem die Rundung nachprüfbar wird:
        // Zwölf gleiche Raten ergeben nicht den Jahresvorschuss, sondern etwas
        // mehr. Diese Zahl selbst ausrechnen zu lassen, wäre eine Zumutung —
        // und genau das Nachrechnen, das die Angabe ersparen soll.
        { text: formatCents(u.raten.billedCents) },
      ];
    }),
  );

  // Der Ausweis der Rundung. Er steht hier bewusst als ganzer Satz und nicht als
  // Fußnotenzeichen: Eine Überdeckung, die niemand benennt, sieht wie ein
  // Rechenfehler aus — und der Eigentümer, der sie bemerkt, fragt nach.
  const ueberdeckung = input.units.reduce((s, u) => s + u.raten.overpayCents, 0);
  if (ueberdeckung > 0 && input.rounding && input.rounding !== "CENT") {
    doc.space(mm(2));
    doc.para(
      `Die monatlichen Raten sind ${hausgeldRoundingLabels[input.rounding]} aufgerundet — ` +
        "so ist jede der zwölf Raten gleich hoch und ein Dauerauftrag passt das ganze Jahr. " +
        `Über alle Einheiten ergibt das ${formatCents(ueberdeckung)} mehr als der ` +
        `Vorschussbedarf von ${formatCents(input.totalCents)}. Diese Überdeckung ist ein ` +
        "Guthaben der Eigentümer und wird mit der Jahresabrechnung verrechnet " +
        "(§ 28 Abs. 2 WEG).",
      { size: size.small, color: color.muted, width: CONTENT_WIDTH, lead: mm(4.5) },
    );
  }

  // ── Beschlussvorlage ───────────────────────────────────────────────────────
  //
  // Die Rundung gehört in den Beschlusstext, nicht nur in die Erläuterung: Was
  // die Verwaltung monatlich einzieht, sind die gerundeten Raten. Ein Beschluss,
  // der nur den ungerundeten Vorschussbedarf nennt, deckt sie nicht — und die
  // Sollstellung stünde ohne Grundlage da.
  const vorlage =
    "Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf Grundlage " +
    `des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${input.year} die Vorschüsse zur ` +
    "Kostentragung und zur Zuführung zur Erhaltungsrücklage in Höhe von insgesamt " +
    `${formatCents(input.totalCents)}. Die monatlichen Hausgeld-Vorschüsse je Einheit ergeben ` +
    "sich aus den obigen Einzelwirtschaftsplänen und sind jeweils zum 1. eines Monats fällig." +
    (ueberdeckung > 0 && input.rounding && input.rounding !== "CENT"
      ? ` Die Monatsraten werden ${hausgeldRoundingLabels[input.rounding]} aufgerundet, sodass ` +
        `alle zwölf Raten gleich hoch sind; die dadurch entstehende Überdeckung von ` +
        `${formatCents(ueberdeckung)} wird mit der Jahresabrechnung verrechnet.`
      : "");
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

  // Bewusst ohne die Fußnote „Muster — ersetzt keine Rechtsberatung": Sie stand
  // am Fuß der Seite und bezog sich damit auf das **ganze** Dokument. Das hier
  // ist aber kein Muster, sondern der Wirtschaftsplan dieser Gemeinschaft mit
  // ihren echten Zahlen — Beschlussgegenstand der Versammlung und Grundlage der
  // Sollstellungen. Ihn als Muster zu kennzeichnen ist sachlich falsch und
  // entwertet das Dokument gegenüber jedem, dem es vorgelegt wird.

  return doc.finish({
    left: input.issuer.legalName,
    right: input.resolved
      ? `Wirtschaftsplan ${input.year}`
      : `Wirtschaftsplan ${input.year} (Entwurf)`,
  });
}
