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
  // Eigener Code, weil die Meldung mehr sagt als „hat geklappt": Abgehakt wird
  // hier nur der Vermerk im Programm. Die Anmeldung selbst und die Überweisung
  // ans Finanzamt passieren außerhalb — wer das verwechselt, versäumt die Frist
  // und hält sie für erledigt.
  // Der einzige Fehler-Code in dieser Liste, und das mit Grund: Ein
  // Rechte-Wächter leitet auf eine Liste zurück, an der kein Formular hängt —
  // ein `<Alert>` hätte dort keinen Ort. Ohne Meldung sieht die abgewiesene
  // Aktion aus wie ein Knopf, der nichts tut, und man drückt ihn erneut.
  "keine-berechtigung": {
    text: "Dafür fehlt Ihnen die Berechtigung. Ein Administrator Ihrer Organisation kann das übernehmen.",
    tone: "error",
  },
  "bauabzug-angemeldet": {
    text: "Monat als angemeldet vermerkt. Anmeldung und Überweisung ans Finanzamt erfolgen außerhalb des Programms.",
    tone: "success",
  },
  // Plan-Sperre: Die Funktion existiert, aber der Tarif der Organisation
  // schließt sie nicht ein. Wie „keine-berechtigung" ein Fehler-Code für
  // Wächter, an deren Ziel kein Formular hängt.
  "nur-verwalter-plus": {
    text: "Diese Funktion gehört zum Verwalter-Plus-Tarif. Den Wechsel finden Sie unter Einstellungen → Abrechnung.",
    tone: "error",
  },
  // Plan-Sperre des Start-Umfangs: einrichten und ansehen ist frei, die
  // Arbeitsfunktionen gehören zu den bezahlten Tarifen.
  "nur-mit-tarif": {
    text:
      "Diese Funktion ist im Start-Umfang nicht enthalten. Mit Basic oder " +
      "Verwalter-Plus (Einstellungen → Abrechnung) steht sie sofort wieder offen.",
    tone: "error",
  },
  "anfrage-gesendet": {
    text: "Ihre Anfrage ist beim zertifizierten Verwalter eingegangen. Die Antwort erscheint hier im Portal.",
    tone: "success",
  },
  "tarif-gewechselt": {
    text: "Tarif gewechselt. Die Differenz wird anteilig mit der nächsten Rechnung verrechnet.",
    tone: "success",
  },
} as const satisfies Record<string, FlashMessage>;

export type FlashCode = keyof typeof flashMessages;

/** Übersetzt einen URL-Wert in eine Meldung – unbekannte Codes bleiben stumm. */
export function resolveFlash(code: string | null | undefined): FlashMessage | null {
  if (!code) return null;
  return (flashMessages as Record<string, FlashMessage>)[code] ?? null;
}
