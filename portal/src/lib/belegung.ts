// Warum eine Einheit oder ein Objekt nicht gelöscht werden kann — benannt.
//
// Die Wächter in `objekte/[id]/bearbeiten/actions.ts` zählen elf bzw. achtzehn
// Beziehungen einzeln aus, addieren sie zu **einer** Zahl und meldeten dann
// „z. B. Mieter, Buchungen, Übergaben oder Vorgänge". Das „z. B." gab selbst
// zu, dass die Meldung rät — obwohl die Abfrage eine Zeile vorher genau weiß,
// dass es zwei Eigentümer und drei Sollstellungen sind.
//
// Wer beim Einrichten eine Einheit doppelt angelegt hat, steht damit vor einer
// Wand ohne Tür: Die Sperre ist richtig, aber sie sagt nicht, was zu lösen ist.
// Genau in der Einrichtungsphase, in der Fehler am wahrscheinlichsten sind.
//
// Diese Datei hält die Übersetzung an **einer** Stelle, weil dieselbe Auskunft
// an zwei Orten gebraucht wird: als Hinweis unter der Einheit (dort liegen die
// Zahlen ohnehin vor) und als Meldung nach einem abgewiesenen Löschversuch
// (dort müssen sie über die URL reisen).

export type BelegungArt = "einheit" | "objekt";

/** Singular, Plural und ob man die Verknüpfung selbst hier lösen kann. */
type Posten = { ein: string; viele: string; loesbar?: boolean };

const EINHEIT: Record<string, Posten> = {
  tenancies: { ein: "Mietverhältnis", viele: "Mietverhältnisse", loesbar: true },
  unitOwnerships: { ein: "Eigentümer", viele: "Eigentümer", loesbar: true },
  hausgeldPayments: { ein: "Hausgeldzahlung", viele: "Hausgeldzahlungen" },
  duePostings: { ein: "Sollstellung", viele: "Sollstellungen" },
  hausgeldMahnungen: { ein: "Mahnung", viele: "Mahnungen" },
  statementUnitAmounts: { ein: "Abrechnungsposition", viele: "Abrechnungspositionen" },
  sepaMandates: { ein: "SEPA-Mandat", viele: "SEPA-Mandate" },
  handovers: { ein: "Übergabe", viele: "Übergaben" },
  tickets: { ein: "Vorgang", viele: "Vorgänge" },
  documents: { ein: "Dokument", viele: "Dokumente" },
  meters: { ein: "Zähler", viele: "Zähler" },
};

const OBJEKT: Record<string, Posten> = {
  units: { ein: "Einheit", viele: "Einheiten", loesbar: true },
  tickets: { ein: "Vorgang", viele: "Vorgänge" },
  documents: { ein: "Dokument", viele: "Dokumente" },
  announcements: { ein: "Aushang", viele: "Aushänge" },
  ownerships: { ein: "Eigentümer", viele: "Eigentümer", loesbar: true },
  resolutions: { ein: "Beschluss", viele: "Beschlüsse" },
  ownersMeetings: { ein: "Versammlung", viele: "Versammlungen" },
  ownerMotions: { ein: "Antrag", viele: "Anträge" },
  maintenanceTasks: { ein: "Wartungsaufgabe", viele: "Wartungsaufgaben" },
  costTypes: { ein: "Kostenart", viele: "Kostenarten" },
  ledgerAccounts: { ein: "Konto", viele: "Konten" },
  bookings: { ein: "Buchung", viele: "Buchungen" },
  bankImportBatches: { ein: "Kontoimport", viele: "Kontoimporte" },
  economicPlans: { ein: "Wirtschaftsplan", viele: "Wirtschaftspläne" },
  duePostings: { ein: "Sollstellung", viele: "Sollstellungen" },
  annualStatements: { ein: "Jahresabrechnung", viele: "Jahresabrechnungen" },
  hausgeldMahnungen: { ein: "Mahnung", viele: "Mahnungen" },
  sonderumlagen: { ein: "Sonderumlage", viele: "Sonderumlagen" },
  maintenanceMeasures: { ein: "Erhaltungsmaßnahme", viele: "Erhaltungsmaßnahmen" },
  sepaMandates: { ein: "SEPA-Mandat", viele: "SEPA-Mandate" },
  co2Allocations: { ein: "CO₂-Aufteilung", viele: "CO₂-Aufteilungen" },
  beiratTasks: { ein: "Beiratsaufgabe", viele: "Beiratsaufgaben" },
  meters: { ein: "Zähler", viele: "Zähler" },
};

function katalog(art: BelegungArt): Record<string, Posten> {
  return art === "einheit" ? EINHEIT : OBJEKT;
}

/**
 * Die benannten Beziehungen je Art – für die Gegenprobe gegen die Wächter.
 *
 * Wer dort eine Beziehung ergänzt und sie hier vergisst, bekommt keinen
 * Fehler: Sie sperrt weiterhin, wird aber nicht mehr genannt. Die Meldung
 * verliert damit still genau die Auskunft, für die es diese Datei gibt.
 */
export const belegungSchluessel: Record<BelegungArt, readonly string[]> = {
  einheit: Object.keys(EINHEIT),
  objekt: Object.keys(OBJEKT),
};

export type BelegungPosten = { key: string; anzahl: number; text: string; loesbar: boolean };

/**
 * Die belegten Beziehungen, benannt und gezählt — leere fallen weg.
 *
 * Nimmt bewusst ein loses `Record` statt des Prisma-`_count`-Typs: Die Aufrufer
 * reichen `_count` unverändert durch, und ein zusätzliches Feld dort soll hier
 * keinen Typfehler auslösen, sondern schlicht unbenannt bleiben.
 */
export function belegungPosten(
  art: BelegungArt,
  counts: Record<string, number>,
): BelegungPosten[] {
  const k = katalog(art);
  const posten: BelegungPosten[] = [];
  for (const [key, anzahl] of Object.entries(counts)) {
    const p = k[key];
    if (!p || !anzahl) continue;
    posten.push({
      key,
      anzahl,
      text: `${anzahl} ${anzahl === 1 ? p.ein : p.viele}`,
      loesbar: p.loesbar === true,
    });
  }
  return posten;
}

/** „2 Eigentümer, 3 Sollstellungen" — leer, wenn nichts belegt ist. */
export function belegungText(art: BelegungArt, counts: Record<string, number>): string {
  return belegungPosten(art, counts)
    .map((p) => p.text)
    .join(", ");
}

/**
 * Der Weg zum Lösen — aber nur, wo es einen gibt.
 *
 * Eigentümer und Mieter kann man hier abziehen, eine gebuchte Sollstellung
 * nicht. Ein pauschales „lösen Sie die Verknüpfungen" wäre bei Buchungen eine
 * Aufforderung zu etwas Unmöglichem; dann ist Archivieren die ehrliche Antwort.
 */
export function belegungHinweis(art: BelegungArt, counts: Record<string, number>): string {
  const posten = belegungPosten(art, counts);
  if (posten.length === 0) return "";
  const loesbar = posten.filter((p) => p.loesbar);
  if (loesbar.length === posten.length) {
    return art === "einheit"
      ? "Entfernen Sie diese Zuordnungen oben in der Einheit, danach ist das Löschen möglich."
      : "Entfernen Sie diese Einträge zuerst, danach ist das Löschen möglich.";
  }
  return art === "einheit"
    ? "Buchungen und Abrechnungsdaten lassen sich nicht entfernen — eine Einheit mit Zahlungsverkehr bleibt bestehen."
    : "Buchungen und Abrechnungsdaten lassen sich nicht entfernen. Archivieren Sie das Objekt stattdessen.";
}

// ── Übertragung über die URL ────────────────────────────────────────────────
// Nicht der fertige Text, sondern Schlüssel und Zahlen: Eine übersetzte
// Zeichenkette aus der Adresszeile landete sonst ungeprüft in der Seite.
// Beim Einlesen entscheidet der Katalog, was gilt — unbekannte Schlüssel
// fallen weg, Zahlen werden geparst.

export function encodeBelegung(art: BelegungArt, counts: Record<string, number>): string {
  return belegungPosten(art, counts)
    .map((p) => `${p.key}:${p.anzahl}`)
    .join(",");
}

export function decodeBelegung(art: BelegungArt, raw: string | undefined): BelegungPosten[] {
  if (!raw) return [];
  const counts: Record<string, number> = {};
  for (const teil of raw.split(",").slice(0, 40)) {
    const [key, wert] = teil.split(":");
    const n = Number.parseInt(wert ?? "", 10);
    if (key && Number.isFinite(n) && n > 0) counts[key] = n;
  }
  return belegungPosten(art, counts);
}
