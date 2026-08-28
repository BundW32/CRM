// ── Abschaltbare Funktionsbereiche ───────────────────────────────────────────
//
// Ein Bereich, der vorerst nicht benutzt werden soll, wird hier **geschaltet**,
// nicht ausgebaut. Der Unterschied ist praktisch: Ein Rückbau nimmt Menüpunkte,
// Routen, Hilfetexte und Werbung auseinander und muss beim Wiedereinschalten
// Stück für Stück zurückgebaut werden — mit der sicheren Aussicht, dass eine
// Stelle vergessen wird. Ein Schalter ist eine Zeile in der Umgebung.
//
// Regeln für alles, was hier hängt:
//
// 1. **Serverseitig.** `process.env` ohne `NEXT_PUBLIC_`-Präfix steht nur auf
//    dem Server. Aus einer Client-Komponente aufgerufen fiele der Helfer still
//    auf den Standardwert zurück — dieselbe Falle wie bei `APP_MODE`
//    (siehe `app-mode.ts`). Alle Aufrufer sind Server-Komponenten,
//    Server-Actions oder Route-Handler; das muss so bleiben.
// 2. **Die Route wird mitgesperrt, nicht nur der Link.** Ein entfernter
//    Menüpunkt lässt ein Lesezeichen unberührt — und eine gespeicherte URL darf
//    nicht ins Nichts führen.
// 3. **Datenmodell und Fachlogik bleiben unberührt.** Abgeschaltet wird der
//    Zugang, nicht der Bestand: `SepaMandate`, `Property.sepaCreditorId` und
//    `lib/weg/sepa.ts` samt Tests laufen weiter.

/**
 * SEPA-Basislastschrift (Hausgeldeinzug per pain.008-Datei).
 *
 * **Vorerst abgeschaltet.** Zum Wiedereinschalten genügt die Umgebungsvariable
 * `SEPA_LASTSCHRIFT=an` (Vercel → Project → Environment Variables); damit
 * erscheinen Menüpunkt, Route, Export und die Erwähnungen in Bedienhilfe und
 * auf den öffentlichen Seiten wieder.
 *
 * Bewusst strikter Vergleich auf `"an"`: Ein Tippfehler oder ein leer gesetzter
 * Wert schaltet die Funktion nicht versehentlich frei.
 *
 * Am Schalter hängen: der Menüpunkt im WEG-Arbeitsbereich, die Route
 * `…/lastschrift` samt Export und Server-Actions, der Hinweis in
 * `assistant-help.ts`, die Integrationskarte und die Werbung auf Startseite und
 * `/funktionen/hausgeld`.
 *
 * **Eine Stelle bleibt von Hand:** die Tarifzeile in `preise/tarif-bereich.tsx`.
 * Die Komponente läuft im Browser, wo dieser Helfer nicht greift — dort ist
 * „, SEPA-Einzug" beim Wiedereinschalten zurückzuschreiben (Kommentar steht an
 * der Zeile).
 */
export function isSepaLastschriftEnabled(): boolean {
  return process.env.SEPA_LASTSCHRIFT === "an";
}
