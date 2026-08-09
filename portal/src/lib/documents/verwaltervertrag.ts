// Mustervertrag für die Selbstverwaltung: Verwaltervertrag zwischen der
// Gemeinschaft der Wohnungseigentümer (GdWE) und einem aus ihrer Mitte
// bestellten Wohnungseigentümer („interner Verwalter").
//
// Das Dokument ist ein MUSTER zum Ausfüllen — Objekt und Absender kommen aus
// dem Bestand, alle Vereinbarungen (Laufzeit, Vergütung, Grenzen) bleiben
// bewusst Ausfülllinien: Sie gehören in den Beschluss der Versammlung, nicht
// in eine Software-Vorgabe. Rechtsgrundlagen im Text sind der Stand nach dem
// WEMoG (§§ 9b, 19, 24, 26, 26a, 27, 28 WEG); jede Änderung daran bitte
// gegen den Gesetzestext prüfen.
//
// Aufgebaut auf lib/documents/kit, wie die übrigen Berichte des Portals.
import {
  Doc,
  checkboxLine,
  color,
  drawReportHead,
  formSection,
  mm,
  size,
  type LetterIssuer,
} from "./kit";
import type { RGB } from "pdf-lib";

/**
 * Angaben aus dem Ausfüll-Formular der Seite `/verwaltung/verwaltervertrag`.
 * Jede Angabe ist freiwillig — was fehlt, bleibt im PDF eine Ausfülllinie,
 * damit dasselbe Dokument auch als leeres Muster taugt. Alle Werte kommen
 * bereits formatiert an (Daten als TT.MM.JJJJ, Beträge als Text).
 */
export type VerwaltervertragAngaben = {
  /** Wer den Vertrag für die Gemeinschaft unterschreibt. */
  vertreterName?: string;
  /** Datum des Bestellungs-/Ermächtigungsbeschlusses. */
  beschlussDatum?: string;
  topNummer?: string;
  verwalterName?: string;
  verwalterAnschrift?: string;
  beginn?: string;
  ende?: string;
  /** Betragsgrenze im Innenverhältnis (§ 5), als Text ohne €-Zeichen. */
  innenGrenzeEur?: string;
  verguetung?: "EHRENAMT" | "AUFWAND";
  verguetungBetragEur?: string;
  verguetungIntervall?: "MONAT" | "JAHR";
  /** Haftungsgrenze bei einfacher Fahrlässigkeit (§ 8), als Text ohne €-Zeichen. */
  haftungGrenzeEur?: string;
  sonderleistungen?: string;
  /** Ort für die Unterschriftszeilen (das Datum bleibt der Unterschrift vorbehalten). */
  ort?: string;
};

export type VerwaltervertragInput = {
  propertyName: string;
  /** Straße und Ort des Objekts, sofern erfasst. */
  propertyAddress?: string | null;
  /**
   * Zahl der Wohn-/Gewerbeeinheiten — für den Kopf und den
   * Zertifizierungs-Hinweis. OHNE Stellplätze: Der Vertrag weist die
   * Vergütung je Einheit aus, und Stellplätze sind keine Einheiten im Sinne
   * dieser Zählung (dieselbe Abgrenzung wie in billing-mengen.ts).
   */
  unitsCount?: number | null;
  /** Zahl der Stellplatz-/Garagen-Einheiten — separat ausgewiesen. */
  stellplaetzeCount?: number | null;
  issuer: LetterIssuer;
  brand?: RGB;
  /** Pfad zu einer PNG-Datei oder die Bilddaten selbst (Mandantenlogo). */
  logo?: string | Uint8Array | null;
  generatedAt: Date;
  angaben?: VerwaltervertragAngaben;
};

const BLANK = "________________________";
const BLANK_KURZ = "____________";

/** Angabe aus dem Formular oder Ausfülllinie — nie ein leerer Fleck im Vertrag. */
function oder(wert: string | undefined, linie: string = BLANK_KURZ): string {
  const getrimmt = wert?.trim();
  return getrimmt ? getrimmt : linie;
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Nummerierter Paragraf mit Fließtext-Absätzen. */
function paragraf(doc: Doc, titel: string, absaetze: string[]): void {
  doc.section(titel);
  for (const absatz of absaetze) {
    doc.para(absatz);
    doc.space(mm(2));
  }
}

/** Erläuterung in kleinerer, grauer Schrift — Hilfe beim Ausfüllen, kein Vertragstext. */
function hinweis(doc: Doc, text: string): void {
  doc.para(`Hinweis: ${text}`, { size: size.small, color: color.muted });
  doc.space(mm(2));
}

export async function generateVerwaltervertrag(input: VerwaltervertragInput): Promise<Buffer> {
  const a = input.angaben ?? {};
  const ausgefuellt = Object.values(a).some((wert) => wert && String(wert).trim());
  const doc = await Doc.create({
    title: `Verwaltervertrag (Muster) — ${input.propertyName}`,
    author: input.issuer.legalName,
    subject: `Mustervertrag für die Selbstverwaltung, ${input.propertyName}`,
    brand: input.brand,
    // Der Vertrag wird ausgefüllt und abgelegt, nie kuvertiert.
    marks: false,
  });
  doc.newPage();

  await drawReportHead(doc, {
    issuer: input.issuer,
    logo: input.logo,
    title: "Verwaltervertrag",
    subtitle:
      `${input.propertyName}\n` +
      "Muster für die Bestellung eines Wohnungseigentümers zur Verwalterin / zum Verwalter (Selbstverwaltung)",
    status: {
      text: ausgefuellt
        ? "Im Portal ausgefüllt — von der Versammlung zu beschließen, dann unterschreiben"
        : "Muster — von der Gemeinschaft auszufüllen und zu beschließen",
      tone: "neutral",
    },
    meta: [
      ["Stand", fmtDate(input.generatedAt)],
      ...(input.unitsCount ? ([["Einheiten", String(input.unitsCount)]] as [string, string][]) : []),
      ...(input.stellplaetzeCount
        ? ([["Stellplätze/Garagen", String(input.stellplaetzeCount)]] as [string, string][])
        : []),
    ],
  });

  // ── Parteien ───────────────────────────────────────────────────────────────
  // Heißt das Objekt bereits „WEG …" oder „…gemeinschaft …", würde der
  // GdWE-Vorsatz den Namen doppeln („Gemeinschaft der Wohnungseigentümer
  // WEG Musterstraße 12").
  const gdweName = /weg|gemeinschaft/i.test(input.propertyName)
    ? input.propertyName
    : `Gemeinschaft der Wohnungseigentümer ${input.propertyName}`;
  formSection(doc, "Vertragsparteien", [
    { label: "Gemeinschaft (GdWE)", value: gdweName },
    { label: "Anschrift der Wohnanlage", value: input.propertyAddress?.trim() || "" },
    { label: "vertreten durch (Name)", value: a.vertreterName?.trim() || "" },
    { label: "ermächtigt durch Beschluss vom", value: a.beschlussDatum?.trim() || "" },
    { label: "Verwalter/in (Name)", value: a.verwalterName?.trim() || "" },
    { label: "Anschrift des Verwalters", value: a.verwalterAnschrift?.trim() || "" },
  ]);
  hinweis(
    doc,
    "Für die Gemeinschaft unterschreibt nicht der Verwalter selbst, sondern ein anderer, " +
      "durch Beschluss ermächtigter Wohnungseigentümer — üblicherweise der Vorsitz des " +
      "Verwaltungsbeirats (§ 181 BGB, kein Insichgeschäft).",
  );

  // ── Vertragstext ───────────────────────────────────────────────────────────
  paragraf(doc, "§ 1  Bestellung und Vertragsgegenstand", [
    `Die Eigentümerversammlung hat die Verwalterin / den Verwalter mit Beschluss vom ` +
      `${oder(a.beschlussDatum)} (TOP ${oder(a.topNummer)}) gemäß § 26 Abs. 1 WEG zum Verwalter der Gemeinschaft bestellt. ` +
      "Bestellung (Organstellung) und dieser Vertrag sind rechtlich getrennt; der Vertrag regelt " +
      "das schuldrechtliche Verhältnis zwischen der Gemeinschaft und der Verwalterin / dem " +
      "Verwalter als Geschäftsbesorgung (§ 675 BGB).",
    "Die Verwalterin / der Verwalter ist selbst Wohnungseigentümer/in dieser Gemeinschaft und " +
      "übt das Amt persönlich aus.",
  ]);

  paragraf(doc, "§ 2  Beginn und Laufzeit", [
    `Die Bestellung beginnt am ${oder(a.beginn)} und ist befristet bis zum ${oder(a.ende)}. ` +
      "Es gelten die gesetzlichen Höchstfristen: höchstens fünf Jahre, im Fall der ersten " +
      "Bestellung nach der Begründung des Wohnungseigentums höchstens drei Jahre " +
      "(§ 26 Abs. 2 Satz 1 WEG). Eine wiederholte Bestellung ist durch erneuten Beschluss " +
      "möglich; sie kann frühestens ein Jahr vor Ablauf der Bestellzeit gefasst werden " +
      "(§ 26 Abs. 2 Satz 2 WEG).",
    "Die Laufzeit dieses Vertrags ist an die Bestellung gekoppelt: Er endet, ohne dass es " +
      "einer Kündigung bedarf, mit dem Ende der Bestellzeit, sofern die Gemeinschaft nicht " +
      "neu bestellt.",
  ]);

  paragraf(doc, "§ 3  Abberufung, Kündigung, Amtsniederlegung", [
    "Die Gemeinschaft kann die Verwalterin / den Verwalter jederzeit und ohne Angabe von " +
      "Gründen abberufen (§ 26 Abs. 3 Satz 1 WEG); dieses Recht kann durch Vereinbarung " +
      "nicht eingeschränkt werden (§ 26 Abs. 5 WEG). Der Vertrag endet spätestens sechs " +
      "Monate nach der Abberufung (§ 26 Abs. 3 Satz 2 WEG).",
    "Das Recht beider Seiten zur außerordentlichen Kündigung aus wichtigem Grund bleibt " +
      "unberührt. Die Verwalterin / der Verwalter kann das Amt mit einer Frist von drei " +
      "Monaten zum Monatsende niederlegen, aus wichtigem Grund auch fristlos; die " +
      "Niederlegung ist gegenüber den Wohnungseigentümern zu erklären.",
  ]);

  doc.section("§ 4  Aufgaben (Grundleistungen)");
  doc.para(
    "Die Verwalterin / der Verwalter nimmt die gesetzlichen Aufgaben und Befugnisse nach " +
      "den §§ 24, 27 und 28 WEG wahr, insbesondere:",
  );
  doc.space(mm(1.5));
  for (const punkt of [
    "Einberufung, Leitung und Protokollierung der Eigentümerversammlung (§ 24 WEG) einschließlich Wahrung der Ladungsfrist von drei Wochen (§ 24 Abs. 4 WEG),",
    "Führung der Beschluss-Sammlung (§ 24 Abs. 7 WEG),",
    "Durchführung der Beschlüsse der Wohnungseigentümer,",
    "Maßnahmen ordnungsmäßiger Verwaltung, die untergeordnete Bedeutung haben und nicht zu erheblichen Verpflichtungen führen (§ 27 Abs. 1 Nr. 1 WEG),",
    "Maßnahmen, die zur Wahrung einer Frist oder zur Abwendung eines Nachteils erforderlich sind, etwa Notreparaturen (§ 27 Abs. 1 Nr. 2 WEG),",
    "Aufstellung des Wirtschaftsplans mit Einzelwirtschaftsplänen, der Jahresabrechnung mit Einzelabrechnungen und des Vermögensberichts (§ 28 WEG),",
    "ordnungsgemäße, belegte Buchführung; getrennte Führung der Erhaltungsrücklage,",
    "Einziehung des Hausgelds, Überwachung der Zahlungseingänge und Mahnwesen,",
    "Abwicklung des Zahlungsverkehrs ausschließlich über Konten der Gemeinschaft,",
    "geordnete Verwahrung der Verträge, Belege und sonstigen Unterlagen der Gemeinschaft.",
  ]) {
    doc.para(`–  ${punkt}`);
    doc.space(mm(1));
  }
  doc.space(mm(1.5));
  doc.para(
    "Bücher, Beschluss-Sammlung und Dokumente werden im digitalen Verwaltungsportal der " +
      "Gemeinschaft geführt; sämtliche Daten stehen der Gemeinschaft zu.",
  );
  doc.space(mm(2));

  paragraf(doc, "§ 5  Grenzen im Innenverhältnis (§ 27 Abs. 2 WEG)", [
    `Im Innenverhältnis darf die Verwalterin / der Verwalter ohne vorherigen Beschluss ` +
      `Maßnahmen mit Kosten bis zu ${oder(a.innenGrenzeEur)} € im Einzelfall veranlassen. Maßnahmen nach ` +
      "§ 27 Abs. 1 Nr. 2 WEG (Fristwahrung, Abwendung eines Nachteils) bleiben unberührt. " +
      "Die Vertretungsmacht der Gemeinschaft nach außen (§ 9b Abs. 1 WEG) wird hierdurch " +
      "nicht beschränkt.",
  ]);

  doc.section("§ 6  Vergütung und Auslagen");
  if (!a.verguetung) doc.para("Zutreffendes ankreuzen und ergänzen:");
  doc.space(mm(2));
  const intervallWort =
    a.verguetungIntervall === "MONAT"
      ? "Monat"
      : a.verguetungIntervall === "JAHR"
        ? "Jahr"
        : "☐ Monat   ☐ Jahr";
  checkboxLine(
    doc,
    "Die Verwalterin / der Verwalter ist ehrenamtlich tätig und erhält keine Vergütung.",
    a.verguetung === "EHRENAMT",
  );
  checkboxLine(
    doc,
    `Die Verwalterin / der Verwalter erhält eine Aufwandsentschädigung von ` +
      `${oder(a.verguetungBetragEur)} € je ${intervallWort}.`,
    a.verguetung === "AUFWAND",
  );
  doc.space(mm(1));
  doc.para(
    "Nachgewiesene Auslagen (z. B. Porto, Kopien, Fahrtkosten) werden zusätzlich erstattet. " +
      "Die Kosten des Verwaltungsportals trägt die Gemeinschaft als Kosten der Verwaltung. " +
      "Änderungen der Vergütung bedürfen eines Beschlusses der Gemeinschaft.",
  );
  doc.space(mm(2));
  doc.para(
    "Leistungen außerhalb der Grundleistungen des § 4 (z. B. eine zusätzliche, von einzelnen " +
      "Eigentümern veranlasste Versammlung oder die Begleitung größerer Baumaßnahmen) werden " +
      `nur nach vorheriger Vereinbarung gesondert vergütet: ${oder(a.sonderleistungen, BLANK)}`,
  );
  doc.space(mm(2));

  paragraf(doc, "§ 7  Konten und Vermögen der Gemeinschaft", [
    "Sämtliche Konten werden auf den Namen der Gemeinschaft der Wohnungseigentümer geführt. " +
      "Eine Vermischung mit dem Vermögen der Verwalterin / des Verwalters ist unzulässig. " +
      "Die Erhaltungsrücklage wird getrennt von den laufenden Mitteln geführt.",
  ]);

  paragraf(doc, "§ 8  Haftung und Versicherung", [
    "Die Verwalterin / der Verwalter führt das Amt mit der Sorgfalt einer ordentlichen " +
      "Verwalterin / eines ordentlichen Verwalters. Für Vorsatz und grobe Fahrlässigkeit " +
      `wird unbeschränkt gehaftet. Für einfache Fahrlässigkeit wird die Haftung auf ${oder(a.haftungGrenzeEur)} € ` +
      "je Schadensfall begrenzt; diese Begrenzung gilt nicht für die Verletzung von Leben, " +
      "Körper oder Gesundheit und nicht für die Verletzung wesentlicher Vertragspflichten.",
    "Die Gemeinschaft prüft den Abschluss einer Vermögensschaden-Haftpflichtversicherung " +
      "für die Verwalterin / den Verwalter oder eine entsprechende Erweiterung bestehender " +
      "Versicherungen; die Prämie trägt die Gemeinschaft.",
  ]);

  paragraf(doc, "§ 9  Verschwiegenheit und Datenschutz", [
    "Die Verwalterin / der Verwalter behandelt die Angelegenheiten der Gemeinschaft und der " +
      "einzelnen Eigentümer vertraulich, auch nach dem Ende des Amts. Personenbezogene Daten " +
      "werden nur verarbeitet, soweit dies für die Verwaltung erforderlich ist; Unterlagen " +
      "und Daten der Gemeinschaft stehen ausschließlich dieser zu.",
  ]);

  paragraf(doc, "§ 10  Beendigung: Herausgabe und Rechnungslegung", [
    "Bei Beendigung des Amts gibt die Verwalterin / der Verwalter unverzüglich sämtliche " +
      "Unterlagen, Schlüssel, Zugangsdaten und Vermögenswerte der Gemeinschaft heraus, wirkt " +
      "an einer geordneten Übergabe mit und legt über die Amtszeit Rechnung, soweit dies " +
      "nicht bereits durch die Jahresabrechnungen geschehen ist.",
  ]);

  paragraf(doc, "§ 11  Schlussbestimmungen", [
    "Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform und, soweit " +
      "erforderlich, eines Beschlusses der Gemeinschaft. Sollte eine Bestimmung unwirksam " +
      "sein oder werden, bleibt der Vertrag im Übrigen wirksam. Für Streitigkeiten aus " +
      "diesem Vertrag ist das Gericht zuständig, in dessen Bezirk die Wohnanlage liegt " +
      "(§ 43 WEG).",
  ]);

  // ── Hinweise zum Ausfüllen ─────────────────────────────────────────────────
  doc.section("Hinweise zum Ausfüllen");
  hinweis(
    doc,
    "Beschlüsse: Sowohl die Bestellung als auch der Abschluss dieses Vertrags bedürfen eines " +
      "Beschlusses der Eigentümerversammlung. Üblich ist ein Beschluss, der zugleich eine " +
      "Person zum Abschluss und zur Unterzeichnung des Vertrags ermächtigt.",
  );
  hinweis(
    doc,
    "Zertifizierung: In Gemeinschaften mit weniger als neun Sondereigentumsrechten braucht " +
      "ein zum Verwalter bestellter Wohnungseigentümer keine Zertifizierung nach § 26a WEG, " +
      "solange nicht ein Drittel der Eigentümer sie verlangt (§ 19 Abs. 2 Nr. 6 WEG).",
  );
  hinweis(
    doc,
    "Dieses Muster ist eine allgemeine Vorlage und keine Rechtsberatung. Passen Sie es an " +
      "die Verhältnisse Ihrer Gemeinschaft an; im Zweifel lassen Sie es rechtlich prüfen.",
  );

  // ── Unterschriften ─────────────────────────────────────────────────────────
  // Der Ort darf aus dem Formular kommen, das Datum bleibt der Unterschrift
  // vorbehalten — ein vorgedrucktes Unterschriftsdatum wäre schlicht falsch.
  const ortDatum = a.ort?.trim() ? `${a.ort.trim()}, den ${BLANK_KURZ}` : `Ort, Datum: ${BLANK}`;
  const vertreterZeile = a.vertreterName?.trim()
    ? `${a.vertreterName.trim()} — für die Gemeinschaft der Wohnungseigentümer (durch Beschluss ermächtigt)`
    : "Für die Gemeinschaft der Wohnungseigentümer (durch Beschluss ermächtigt)";
  const verwalterZeile = a.verwalterName?.trim()
    ? `${a.verwalterName.trim()} — Verwalter/in`
    : "Die Verwalterin / der Verwalter";
  doc.space(mm(4));
  doc.para(ortDatum);
  await doc.signature(null, vertreterZeile);
  doc.space(mm(4));
  doc.para(ortDatum);
  await doc.signature(null, verwalterZeile);

  // Bei selbstverwalteten WEGs heißen Absender und Objekt oft gleich — dann
  // stünde derselbe Name zweimal nebeneinander in der Fußzeile.
  const fussLinks =
    input.issuer.legalName === input.propertyName
      ? input.propertyName
      : `${input.issuer.legalName} · ${input.propertyName}`;
  return doc.finish({
    left: fussLinks,
    right: `Verwaltervertrag (Muster), Stand ${fmtDate(input.generatedAt)}`,
  });
}
