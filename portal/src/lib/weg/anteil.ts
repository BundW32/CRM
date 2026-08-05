// Miteigentumsanteil einer Person an EINER Einheit, in Prozent.
//
// Der Wert ist der Faktor, mit dem `mea-sync` den MEA der Einheit auf ihre
// Eigentümer verteilt. Fehlt er, zählt jeder Miteigentümer die Einheit voll —
// ein Ehepaar mit je der Hälfte verdoppelte so den MEA seiner Einheit, und die
// Summe über alle Einheiten lag über dem Nenner der Teilungserklärung. Genau
// das ist zweimal in Folge in einem Test aufgefallen: einmal 1.147 statt 1.000.
//
// Die Auslegung steht bewusst an EINER Stelle. Drei Formulare schreiben
// `UnitOwnership` (Objekt anlegen, Objekt bearbeiten, WEG-Stammdaten); als
// jedes davon seine eigene Prozent-Auslegung hatte, kannte eines von ihnen den
// Anteil gar nicht.

/** Anteil aus einem Formularwert lesen. Leer oder unbrauchbar → 100 %. */
export function parseAnteil(raw: FormDataEntryValue | null | undefined): number {
  const text = String(raw ?? "")
    .trim()
    .replace(",", ".");
  if (!text) return 100;
  const n = Number.parseFloat(text);
  // Außerhalb von 0–100 ist der Wert kein Anteil. Dann lieber die Vorgabe als
  // eine Zahl, die die Summenprüfung stillschweigend unbrauchbar macht.
  if (!Number.isFinite(n) || n <= 0 || n > 100) return 100;
  // Zwei Nachkommastellen genügen; mehr erzeugt nur Rundungsrauschen im MEA.
  return Math.round(n * 100) / 100;
}

/**
 * Prüft die Anteile EINER Einheit auf ihre Summe.
 *
 * 100 % ist der Sollwert. Darunter fehlt ein Miteigentümer, darüber zählt der
 * MEA der Einheit mehrfach. Beides ist ein Hinweis, keine Sperre: Während der
 * Eingabe ist ein Zwischenstand unter 100 % der Normalfall.
 */
export function anteilSummeStatus(prozente: number[]): {
  summe: number;
  vollstaendig: boolean;
  ueberzeichnet: boolean;
} {
  const summe = Math.round(prozente.reduce((s, p) => s + p, 0) * 100) / 100;
  return { summe, vollstaendig: summe === 100, ueberzeichnet: summe > 100 };
}

/**
 * Vergleichsform eines Personennamens für die Dublettenprüfung.
 *
 * Bewusst NUR für einen Hinweis, nie zum automatischen Zusammenführen: Zwei
 * verschiedene Menschen können gleich heißen — entscheiden muss der Mensch am
 * Formular.
 */
export function namensSchluessel(vorname: string, nachname: string): string {
  return `${vorname} ${nachname}`
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
