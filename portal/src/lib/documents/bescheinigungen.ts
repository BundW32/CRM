// Automatische Erstellung von Standard-Bescheinigungen als PDF.
//
// Beide Dokumente sitzen auf lib/documents/kit: gleiche Schrift, gleiche
// Ränder, gleiche Fußzeile wie alle übrigen Dokumente des Portals.
//
// Die Mietbescheinigung ist ein Brief (DIN 5008 Form B, Fensterumschlag), die
// Wohnungsgeberbestätigung ein Formular: Ihr Inhalt ist in § 19 Abs. 3 BMG
// vorgeschrieben, und wer sie bei der Meldebehörde vorlegt, muss die Angaben
// feldweise wiederfinden.
import { prepareSignaturePng } from "./signature";
import {
  CONTENT_WIDTH,
  DIN,
  Doc,
  checkboxLine,
  color,
  drawLetterHead,
  formGrid,
  formSection,
  mm,
  size,
} from "./kit";
import type { RGB } from "pdf-lib";

export type SignatureImage = { bytes: Uint8Array; mime: string } | null;

// Welche Bescheinigung lässt sich aus dem Anforderungstitel automatisch erstellen?
export function supportedCertificate(title: string): "wohnungsgeber" | "miet" | null {
  const t = title.toLowerCase();
  if (t.includes("wohnungsgeber")) return "wohnungsgeber";
  if (t.includes("mietbescheinigung")) return "miet";
  return null;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(d);
}

function fmtDateShort(d: Date | null): string {
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/**
 * Freigestelltes PNG der Unterschrift. Schlägt das Freistellen fehl, wird das
 * Originalbild verwendet — eine fehlende Unterschrift wäre schlimmer als eine
 * mit Papierhintergrund.
 */
async function preparedSignature(signature: SignatureImage): Promise<Uint8Array | null> {
  if (!signature) return null;
  try {
    const prepared = await prepareSignaturePng(signature.bytes);
    return prepared?.png ?? signature.bytes;
  } catch {
    return signature.bytes;
  }
}

// Briefkopf der ausstellenden Hausverwaltung (org-spezifisch).
export type DocumentIssuer = {
  legalName: string; // Firmenname in der Kopfzeile
  contactLine: string; // „Straße · PLZ Ort · E-Mail"
};

// ── Wohnungsgeberbestätigung (§ 19 Abs. 3 BMG) ─────────────────────────────

export type WohnungsgeberInput = {
  wohnungsgeberName: string;
  wohnungsgeberStrasse: string;
  wohnungsgeberPlzOrt: string;
  wohnungStrasse: string;
  wohnungPlzOrt: string;
  wohnungZusatz: string;
  mieterNamen: string[];
  einzugsdatum: Date | null;
  ausstellungsdatum: Date;
  ort: string; // Ausstellungsort (Sitz der Verwaltung/Wohnungsgeber)
  unterzeichner: string;
  signature: SignatureImage;
  brand?: RGB;
};

/** Zeilen des Ausfüllrasters — mehr Personen kommen auf eine Anlage. */
const PERSON_ROWS = 6;

export async function generateWohnungsgeberbescheinigung(
  input: WohnungsgeberInput,
): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Wohnungsgeberbestätigung — ${input.wohnungStrasse}`,
    author: input.wohnungsgeberName,
    subject: "Bestätigung des Einzugs nach § 19 Abs. 3 BMG",
    brand: input.brand,
  });
  doc.newPage();

  // ── Titel und Rechtsgrundlage ──────────────────────────────────────────────
  doc.y = doc.page.getHeight() - mm(28);
  doc.text("Wohnungsgeberbestätigung", { size: size.title, font: doc.bold, lead: mm(8) });
  doc.text("Bestätigung des Ein- oder Auszugs gegenüber der Meldebehörde", {
    size: size.small,
    color: color.muted,
    lead: mm(6),
  });

  const rechtstext =
    "§ 19 Abs. 3 Bundesmeldegesetz: Der Wohnungsgeber oder eine von ihm beauftragte Person " +
    "hat der meldepflichtigen Person den Ein- oder Auszug schriftlich oder elektronisch " +
    "innerhalb von zwei Wochen zu bestätigen.";
  const rechtHoehe = doc.measure(rechtstext, { size: size.foot, width: CONTENT_WIDTH - mm(8), lead: mm(4) });
  doc.ensure(rechtHoehe + mm(8));
  const boxTop = doc.y + mm(4);
  doc.page.drawRectangle({
    x: DIN.marginLeft,
    y: boxTop - rechtHoehe - mm(6),
    width: CONTENT_WIDTH,
    height: rechtHoehe + mm(6),
    color: color.panel,
  });
  doc.y = boxTop - mm(4.5);
  doc.para(rechtstext, {
    size: size.foot,
    color: color.muted,
    width: CONTENT_WIDTH - mm(8),
    lead: mm(4),
  });
  doc.y = boxTop - rechtHoehe - mm(9);

  // ── Angaben zum Wohnungsgeber ──────────────────────────────────────────────
  formSection(doc, "Angaben zum Wohnungsgeber", [
    { label: "Name, Vorname / Firma", value: input.wohnungsgeberName },
    { label: "Straße, Hausnummer", value: input.wohnungsgeberStrasse },
    { label: "PLZ, Ort", value: input.wohnungsgeberPlzOrt },
  ]);

  checkboxLine(doc, "Der Wohnungsgeber ist gleichzeitig Eigentümer der Wohnung.", true);
  checkboxLine(doc, "Der Wohnungsgeber ist nicht Eigentümer der Wohnung.", false, {
    gap: mm(6),
  });

  // ── Anschrift der Wohnung ──────────────────────────────────────────────────
  formSection(doc, "Anschrift der Wohnung, in die eingezogen / aus der ausgezogen wird", [
    { label: "Straße, Hausnummer", value: input.wohnungStrasse },
    { label: "PLZ, Ort", value: input.wohnungPlzOrt },
    { label: "Wohnungsnummer / Zusatz", value: input.wohnungZusatz },
  ]);

  // ── Ein-/Auszug ────────────────────────────────────────────────────────────
  doc.para(
    `In die oben genannte Wohnung ist/sind am ${fmtDateShort(input.einzugsdatum)} folgende ` +
      "Person(en):",
    { width: CONTENT_WIDTH, lead: mm(6) },
  );
  checkboxLine(doc, "eingezogen", true);
  checkboxLine(doc, "ausgezogen", false, { gap: mm(7) });

  // Das Raster hat feste Zeilen; überzählige Personen kommen auf eine Anlage —
  // niemals stillschweigend weglassen.
  const weitere = input.mieterNamen.length > PERSON_ROWS;
  formGrid(
    doc,
    ["Familienname", "Vorname(n)"],
    input.mieterNamen.slice(0, PERSON_ROWS).map((name) => {
      const parts = name.trim().split(/\s+/);
      const nachname = parts.length > 1 ? parts[parts.length - 1] : name;
      const vorname = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
      return [nachname, vorname];
    }),
    PERSON_ROWS,
  );
  checkboxLine(
    doc,
    weitere
      ? `weitere Personen — siehe Anlage (insgesamt ${input.mieterNamen.length})`
      : "weitere Personen — siehe Anlage",
    weitere,
    { gap: mm(6) },
  );

  // ── Bestätigung, Hinweis und Unterschrift ──────────────────────────────────
  const bestaetigung =
    "Hiermit wird gemäß § 19 Abs. 3 BMG bestätigt, dass die oben genannte(n) Person(en) in " +
    "die angegebene Wohnung eingezogen ist/sind.";
  const hinweis =
    "Nach § 54 Abs. 2 Nr. 1 BMG handelt ordnungswidrig, wer als Wohnungsgeber eine " +
    "Bestätigung nicht, nicht richtig, nicht vollständig oder nicht rechtzeitig ausstellt. " +
    "Die Ordnungswidrigkeit kann mit einer Geldbuße bis zu 1.000 Euro geahndet werden.";
  // Bestätigung, Hinweis und Unterschrift bilden EINEN Block: Eine Unterschrift
  // ohne den Satz, den sie deckt, bestätigt nichts.
  doc.ensure(
    doc.measure(bestaetigung, { font: doc.bold, width: CONTENT_WIDTH }) +
      doc.measure(hinweis, { size: size.foot, width: CONTENT_WIDTH, lead: mm(4) }) +
      mm(43),
  );
  doc.para(bestaetigung, { font: doc.bold, width: CONTENT_WIDTH });
  doc.space(mm(2));
  doc.para(hinweis, { size: size.foot, color: color.muted, width: CONTENT_WIDTH, lead: mm(4) });
  doc.space(mm(3));

  await doc.signature(
    await preparedSignature(input.signature),
    `Unterschrift des Wohnungsgebers${input.unterzeichner ? ` — ${input.unterzeichner}` : ""}`,
    { ort: input.ort, datum: fmtDateShort(input.ausstellungsdatum) },
  );

  // ── Anlage: vollständige Personenliste ─────────────────────────────────────
  // Verhindert, dass Personen ab Nr. 7 aus einer gesetzlich vorgeschriebenen
  // Bescheinigung verschwinden.
  if (weitere) {
    doc.newPage();
    doc.y = doc.page.getHeight() - mm(32);
    doc.text("Anlage zur Wohnungsgeberbestätigung", { size: size.section, font: doc.bold, lead: mm(7) });
    doc.text("Vollständige Liste der eingezogenen Personen", {
      size: size.small,
      color: color.muted,
      lead: mm(8),
    });
    input.mieterNamen.forEach((name, i) => doc.text(`${i + 1}.  ${name}`));
  }

  return doc.finish({
    left: input.wohnungsgeberName,
    right: `Ausgestellt am ${fmtDateShort(input.ausstellungsdatum)}`,
  });
}

// ── Mietbescheinigung ──────────────────────────────────────────────────────
export type MietbescheinigungInput = {
  mieterNamen: string[];
  wohnungAnschrift: string;
  mietbeginn: Date | null;
  vermieterName: string;
  ort: string;
  ausstellungsdatum: Date;
  unterzeichner: string;
  issuer: DocumentIssuer; // Briefkopf der ausstellenden Verwaltung
  signature: SignatureImage;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
};

export async function generateMietbescheinigung(input: MietbescheinigungInput): Promise<Buffer> {
  const doc = await Doc.create({
    title: `Mietbescheinigung — ${input.mieterNamen.join(", ")}`,
    author: input.issuer.legalName,
    subject: `Bestätigung des Mietverhältnisses, ${input.wohnungAnschrift}`,
    brand: input.brand,
  });
  doc.newPage();

  await drawLetterHead(doc, {
    issuer: { legalName: input.issuer.legalName, lines: [input.issuer.contactLine] },
    logo: input.logo,
    // Nur der erste Teil der Kontaktzeile: Die vollständige Zeile passt nicht in
    // die 85 mm des Anschriftfelds und endete abgeschnitten mitten im Wort.
    returnLine: [input.issuer.legalName, input.issuer.contactLine.split(" · ")[0]]
      .filter(Boolean)
      .join(" · "),
    // Die Bescheinigung geht an die Mieter — unter der Anschrift der Wohnung,
    // um die es geht. Nur der Name im Anschriftfeld wäre nicht versandfähig.
    recipient: {
      lines: [...input.mieterNamen, ...input.wohnungAnschrift.split("\n")].filter(Boolean),
    },
    infoBlock: [["Ausgestellt", fmtDate(input.ausstellungsdatum)]],
  });

  doc.subject("Mietbescheinigung", "Bestätigung des Mietverhältnisses");

  doc.text("Mieterin/Mieter", { size: size.small, font: doc.bold, color: color.muted, lead: mm(5) });
  for (const name of input.mieterNamen) doc.text(name);
  doc.space(mm(4));

  doc.text("Anschrift der Wohnung", { size: size.small, font: doc.bold, color: color.muted, lead: mm(5) });
  doc.para(input.wohnungAnschrift);
  doc.space(mm(4));

  doc.text("Mietverhältnis", { size: size.small, font: doc.bold, color: color.muted, lead: mm(5) });
  doc.defList([
    ["Mietbeginn", fmtDate(input.mietbeginn)],
    ["Vermieter/Eigentümer", input.vermieterName],
  ]);
  doc.space(mm(6));

  doc.para(
    input.mieterNamen.length > 1
      ? "Hiermit wird bestätigt, dass die oben genannten Personen Mieter der genannten Wohnung sind."
      : "Hiermit wird bestätigt, dass die oben genannte Person Mieter der genannten Wohnung ist.",
  );
  doc.space(mm(8));

  await doc.signature(
    await preparedSignature(input.signature),
    `Unterschrift${input.unterzeichner ? ` — ${input.unterzeichner}` : ""}`,
    { ort: input.ort, datum: fmtDate(input.ausstellungsdatum) },
  );

  return doc.finish({
    left: input.issuer.legalName,
    right: `Ausgestellt am ${fmtDate(input.ausstellungsdatum)}`,
  });
}
