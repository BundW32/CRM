// Kurzmeldungen nach einer Server-Action („Nutzer gelöscht", „Kontakt angelegt").
//
// Server-Actions können nach `redirect()` nichts mehr rendern – die Rückmeldung
// muss also über die URL reisen. Bisher tat das jede Seite auf eigene Faust mit
// eigenen Parametern (`?angelegt=1`, `?anonymisiert=1`, …), und die Zielseite
// musste das passende `<Alert>` selbst mitbringen. Kam man von woanders zurück,
// fiel die Meldung stillschweigend unter den Tisch – genau so verschwand die
// Bestätigung der DSGVO-Löschung auf dem Weg zurück nach „Kontakte".
//
// Deshalb ein einziger, eindeutiger Parameter: `?flash=<code>`. Der Code wird
// hier zentral in Text und Tonfall übersetzt, der ToastHost in der Portal-Shell
// zeigt ihn auf **jeder** Seite an und räumt den Parameter danach aus der URL.
// Eine neue Rückmeldung braucht damit nur noch einen Eintrag in dieser Liste.
//
// Formularfehler bleiben bewusst als `<Alert>` an ihrem Formular: Sie müssen
// stehen bleiben, bis der Fehler behoben ist, statt nach Sekunden zu verwehen.

export const FLASH_PARAM = "flash";

export type FlashTone = "success" | "error" | "info";

export type FlashMessage = {
  text: string;
  tone: FlashTone;
};

export const flashMessages = {
  "nutzer-geloescht": {
    text: "Nutzer gelöscht. Personenbezogene Daten wurden entfernt.",
    tone: "success",
  },
  "kontakt-angelegt": { text: "Kontakt angelegt.", tone: "success" },
  "kontakt-gespeichert": { text: "Kontakt gespeichert.", tone: "success" },
  "stammdaten-gespeichert": { text: "Stammdaten gespeichert.", tone: "success" },
  "passwort-geaendert": { text: "Passwort geändert.", tone: "success" },
  "unterschrift-gespeichert": { text: "Unterschrift gespeichert.", tone: "success" },
  "vollmacht-erteilt": {
    text: "Vollmacht erteilt. Die Verwaltung darf Bescheinigungen für Ihre vermieteten Einheiten ausstellen.",
    tone: "success",
  },
  "vollmacht-widerrufen": {
    text: "Vollmacht widerrufen. Es werden keine neuen Bescheinigungen in Ihrem Namen erstellt.",
    tone: "info",
  },
  "bescheinigung-erstellt": {
    text: "Bescheinigung erstellt und bereitgestellt.",
    tone: "success",
  },
} as const satisfies Record<string, FlashMessage>;

export type FlashCode = keyof typeof flashMessages;

/** Übersetzt einen URL-Wert in eine Meldung – unbekannte Codes bleiben stumm. */
export function resolveFlash(code: string | null | undefined): FlashMessage | null {
  if (!code) return null;
  return (flashMessages as Record<string, FlashMessage>)[code] ?? null;
}

/** Hängt einen Flash-Code an einen Rücksprungpfad (`/pfad?flash=code`). */
export function withFlash(path: string, code: FlashCode): string {
  return `${path}${path.includes("?") ? "&" : "?"}${FLASH_PARAM}=${code}`;
}
