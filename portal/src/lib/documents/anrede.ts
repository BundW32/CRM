// Anrede und Anschriftzeilen für Briefe.
//
// Bisher stand in jedem Schreiben „Sehr geehrte(r) <voller Name>," — also
// „Sehr geehrte(r) Ayşe Şahin-Grünewald,". Das ist weder eine Anrede noch
// höflich; die Klammerform verrät zudem, dass ein Programm geschrieben hat.
// Die Angaben liegen in der Datenbank (User.salutation, lastName): daraus
// entsteht eine richtige Anrede, und wo sie fehlen, eine, die niemanden
// falsch anspricht.

export type Empfaenger = {
  /** „Herr" oder „Frau" — alles andere gilt als unbekannt. */
  salutation?: string | null;
  /** Nachname; ohne ihn wird der volle Name verwendet. */
  lastName?: string | null;
  /** Vollständiger Name, immer vorhanden. */
  name: string;
};

function istHerr(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase().startsWith("herr");
}
function istFrau(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase().startsWith("frau");
}

/**
 * Die Anredezeile eines Briefes, mit Komma.
 *
 * Mehrere Empfänger (Eheleute, Erbengemeinschaft) erkennt man am Komma im
 * Namen — dort ist jede Einzelanrede falsch, und es bleibt bei der
 * allgemeinen Form.
 */
export function briefAnrede(empfaenger: Empfaenger | null | undefined): string {
  const name = (empfaenger?.name ?? "").trim();
  if (!name || name.includes(",")) return "Sehr geehrte Damen und Herren,";

  const nachname = (empfaenger?.lastName ?? "").trim() || name;
  if (istFrau(empfaenger?.salutation)) return `Sehr geehrte Frau ${nachname},`;
  if (istHerr(empfaenger?.salutation)) return `Sehr geehrter Herr ${nachname},`;

  // Name bekannt, Anrede nicht: „Guten Tag" spricht die Person an, ohne ein
  // Geschlecht zu unterstellen. „Sehr geehrte(r)" tut beides nicht.
  return `Guten Tag ${name},`;
}

/**
 * Die Zeilen des Anschriftfelds: Anrede, Name, Straße, PLZ Ort.
 *
 * Die Anrede steht auf einer eigenen Zeile über dem Namen — so verlangt es
 * DIN 5008, und so erwartet es die Post.
 */
export function anschriftZeilen(
  empfaenger: Empfaenger | null | undefined,
  adresse: string | null | undefined,
): string[] {
  const zeilen: string[] = [];
  const name = (empfaenger?.name ?? "").trim();
  if (istFrau(empfaenger?.salutation)) zeilen.push("Frau");
  else if (istHerr(empfaenger?.salutation)) zeilen.push("Herrn");
  if (name) zeilen.push(name);
  for (const zeile of (adresse ?? "").split("\n")) {
    if (zeile.trim()) zeilen.push(zeile.trim());
  }
  return zeilen;
}
