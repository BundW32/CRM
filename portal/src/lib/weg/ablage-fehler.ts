// Warum die Ablage einer Datei fehlgeschlagen ist — in einem Satz, den ein
// Verwalter lesen kann.
//
// Anlass: Beim Beschließen eines Wirtschaftsplans meldete die Oberfläche
// „konnten nicht in den Dokumenten abgelegt werden" — ohne Grund und ohne Weg
// nach vorn. Der echte Fehler stand allein in `console.error` und damit im
// Server-Log, das ein Verwalter nie sieht. Ein Vorgang, der Erfolg meldet und
// dessen Teilschritt still scheitert, untergräbt das Vertrauen stärker als ein
// fehlendes Feature: Man merkt es erst, wenn ein Eigentümer sein Dokument
// vermisst.
//
// Der Modul liegt aus historischen Gründen unter `lib/weg/` — dort entstand er.
// Er gilt inzwischen für **jeden** Upload des Portals: Dieselbe stumme Lage gab
// es in den normalen Formularen (`catch {}` und `?fehler=datei`), und dort ist
// sie häufiger. Aufrufer siehe `grep -rn "ablageFehler" src`.
//
// Die Meldung geht als Query-Parameter zurück an die Seite und wird dort
// angezeigt. Deshalb ist sie **kurz** und enthält keine internen Pfade,
// Tabellennamen oder Stapelspuren — die bleiben im Log.

/** Obergrenze für den Text in der URL. Länger wird abgeschnitten. */
const MAX_LAENGE = 200;

/**
 * Wer den Fehler beheben kann — und damit, was der Nutzer als Nächstes tun
 * soll. Genau diese drei Fälle sind zu unterscheiden:
 *
 * - `konfiguration` — liegt am System, nicht an der Datei. Der Nutzer kann
 *   nichts tun; eine andere Datei zu wählen hilft nicht und kostet nur Zeit.
 * - `datei` — diese eine Datei geht nicht (Typ, Größe, leer). Eine andere
 *   Datei führt zum Ziel.
 * - `netzwerk` — vorübergehend. Erneut versuchen führt oft zum Ziel.
 * - `unbekannt` — alles Übrige; der rohe Grund wird gekürzt durchgereicht,
 *   statt ihn zu verschlucken.
 */
export type AblageFehlerArt = "konfiguration" | "datei" | "netzwerk" | "unbekannt";

export type AblageFehler = {
  art: AblageFehlerArt;
  /** Der Satz für die Oberfläche. Kurz, ohne Interna. */
  text: string;
};

/** Überschrift des Banners je Art — der Unterschied muss auf einen Blick da sein. */
export const ABLAGE_FEHLER_TITEL: Record<AblageFehlerArt, string> = {
  konfiguration: "Die Dateiablage ist nicht verfügbar",
  datei: "Diese Datei geht nicht",
  netzwerk: "Bitte erneut versuchen",
  unbekannt: "Die Datei konnte nicht abgelegt werden",
};

function kuerze(text: string): string {
  const kurz = text.trim().replace(/\s+/g, " ");
  if (!kurz) return "Der Grund ließ sich nicht ermitteln.";
  return kurz.length > MAX_LAENGE ? `${kurz.slice(0, MAX_LAENGE - 1)}…` : kurz;
}

/**
 * Übersetzt einen Ablage-Fehler in Art und Satz für die Oberfläche.
 *
 * Die Reihenfolge der Prüfungen ist bedeutsam: Die Konfiguration kommt zuerst.
 * „Für Dateien über 5 MB muss Vercel Blob konfiguriert sein" liest sich wie ein
 * Größenproblem, ist aber keines — mit eingerichteter Ablage gehen 100 MB. Wer
 * das als Dateifehler ausgibt, schickt den Verwalter los, seine Datei zu
 * verkleinern, obwohl das nichts ändert.
 */
export function ablageFehler(err: unknown): AblageFehler {
  const roh = err instanceof Error ? err.message : String(err);

  // Der häufigste Fall in Produktion ist eine fehlende oder falsch angelegte
  // Datei-Ablage (Vercel Blob): Dann scheitert **jeder** Upload, nicht nur
  // dieser. Das gehört gesagt, weil die Behebung dann nicht im Portal liegt,
  // sondern in der Konfiguration — sonst sucht man den Fehler bei den Daten.
  if (/Blob-Store|BLOB_READ_WRITE_TOKEN|Vercel Blob/i.test(roh)) {
    return {
      art: "konfiguration",
      text:
        "Die Dateiablage ist nicht verfügbar — dann schlagen auch alle anderen " +
        "Uploads fehl. Das liegt am System, nicht an Ihrer Datei: eine " +
        "Einstellung des Systems, die der Betrieb beheben muss.",
    };
  }
  if (/timeout|timed out|ETIMEDOUT|Transaction .* closed/i.test(roh)) {
    return {
      art: "netzwerk",
      text:
        "Die Ablage hat zu lange gedauert und wurde abgebrochen. Ein erneuter " +
        "Versuch führt bei vielen Einheiten häufig zum Ziel.",
    };
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network|socket hang up/i.test(roh)) {
    return {
      art: "netzwerk",
      text: "Die Verbindung zur Dateiablage kam nicht zustande. Bitte erneut versuchen.",
    };
  }
  // Die Meldungen aus `saveUpload`/`saveBuffer` (Typ, Größe, leer) sind bereits
  // für Menschen geschrieben — sie werden nur eingeordnet, nicht ersetzt.
  if (/ist leer|größer als|Dateityp .* ist nicht erlaubt|nicht erlaubt/i.test(roh)) {
    return {
      art: "datei",
      text: kuerze(`${roh} Bitte wählen Sie eine andere Datei.`),
    };
  }

  return { art: "unbekannt", text: kuerze(roh) };
}

/**
 * Nur der Satz — für die vielen Stellen, die ihn als Query-Parameter
 * weiterreichen. Die Art wird dort nicht gebraucht: Der Satz nennt sie selbst
 * („liegt am System" / „andere Datei" / „erneut versuchen").
 */
export function ablageFehlerText(err: unknown): string {
  return ablageFehler(err).text;
}
