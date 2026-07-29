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
  // ── Allgemeines Vokabular ─────────────────────────────────────────────────
  // Für den Großteil der Aktionen reicht eine knappe Bestätigung. Ein eigener
  // Code je Aktion wäre bei über hundert Formularen unpflegbar und brächte
  // keinen Erkenntnisgewinn: Wer gerade „Kostenart speichern" gedrückt hat,
  // weiß, was gespeichert wurde. Ein eigener Code lohnt erst, wenn die Meldung
  // mehr sagt als „hat geklappt" – siehe die spezifischen Einträge unten.
  gespeichert: { text: "Gespeichert.", tone: "success" },
  erstellt: { text: "Angelegt.", tone: "success" },
  aktualisiert: { text: "Änderungen übernommen.", tone: "success" },
  geloescht: { text: "Gelöscht.", tone: "success" },
  entfernt: { text: "Entfernt.", tone: "success" },
  zugeordnet: { text: "Zugeordnet.", tone: "success" },
  gesendet: { text: "Versandt.", tone: "success" },
  hochgeladen: { text: "Hochgeladen.", tone: "success" },
  importiert: { text: "Import abgeschlossen.", tone: "success" },
  archiviert: { text: "Archiviert.", tone: "info" },
  wiederhergestellt: { text: "Wiederhergestellt.", tone: "success" },

  // Eigener Code, weil die Meldung mehr sagt als „hat geklappt": Die Aktion
  // selbst ist gelungen (Konto angelegt, Link erzeugt), nur die E-Mail ging
  // nicht raus. Ohne den Unterschied wartet der Empfänger auf eine Mail, die
  // nie kommt.
  "versand-aus": {
    text: "E-Mail-Versand ist nicht eingerichtet – es wurde nichts verschickt.",
    tone: "error",
  },

  // ── Spezifische Meldungen ─────────────────────────────────────────────────
  // Hier sagt die Meldung mehr als „hat geklappt": eine Folge, eine
  // Einschränkung oder etwas, das der Nutzer sonst nicht sähe.
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
  "vollmacht-vermerkt": {
    text: "Schriftliche Vollmacht vermerkt.",
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
  // Eigener Code, weil die Meldung mehr sagt als „hat geklappt": Der Schritt
  // verschwindet aus der Liste, und der Assistent rückt sichtbar auf den
  // nächsten vor. Ohne den Hinweis wirkt der Sprung wie ein Fehler.
  "schritt-erledigt": {
    text: "Schritt abgehakt – weiter mit dem nächsten.",
    tone: "success",
  },
} as const satisfies Record<string, FlashMessage>;

export type FlashCode = keyof typeof flashMessages;

/** Übersetzt einen URL-Wert in eine Meldung – unbekannte Codes bleiben stumm. */
export function resolveFlash(code: string | null | undefined): FlashMessage | null {
  if (!code) return null;
  return (flashMessages as Record<string, FlashMessage>)[code] ?? null;
}
