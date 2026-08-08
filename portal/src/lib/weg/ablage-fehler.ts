// Warum die Ablage erzeugter Dokumente fehlgeschlagen ist — in einem Satz, den
// ein Verwalter lesen kann.
//
// Anlass: Beim Beschließen eines Wirtschaftsplans meldete die Oberfläche
// „konnten nicht in den Dokumenten abgelegt werden" — ohne Grund und ohne Weg
// nach vorn. Der echte Fehler stand allein in `console.error` und damit im
// Server-Log, das ein Verwalter nie sieht. Ein Vorgang, der Erfolg meldet und
// dessen Teilschritt still scheitert, untergräbt das Vertrauen stärker als ein
// fehlendes Feature: Man merkt es erst, wenn ein Eigentümer sein Dokument
// vermisst.
//
// Die Meldung geht als Query-Parameter zurück an die Seite und wird dort
// angezeigt. Deshalb ist sie **kurz** und enthält keine internen Pfade,
// Tabellennamen oder Stapelspuren — die bleiben im Log.

/** Obergrenze für den Text in der URL. Länger wird abgeschnitten. */
const MAX_LAENGE = 200;

/**
 * Übersetzt einen Ablage-Fehler in einen Satz für die Oberfläche.
 *
 * Der häufigste Fall in Produktion ist eine fehlende oder falsch angelegte
 * Datei-Ablage (Vercel Blob): Dann scheitert **jeder** Upload, nicht nur
 * dieser. Das gehört gesagt, weil die Behebung dann nicht im Portal liegt,
 * sondern in der Konfiguration — sonst sucht man den Fehler bei den Daten.
 */
export function ablageFehlerText(err: unknown): string {
  const roh = err instanceof Error ? err.message : String(err);

  if (/Blob-Store|BLOB_READ_WRITE_TOKEN|Vercel Blob/i.test(roh)) {
    return (
      "Die Dateiablage ist nicht verfügbar — dann schlagen auch alle anderen " +
      "Uploads fehl. Das ist eine Einstellung des Systems, keine Frage der Daten."
    );
  }
  if (/timeout|timed out|ETIMEDOUT|Transaction .* closed/i.test(roh)) {
    return (
      "Die Ablage hat zu lange gedauert und wurde abgebrochen. Ein erneuter " +
      "Versuch führt bei vielen Einheiten häufig zum Ziel."
    );
  }
  if (/ECONNREFUSED|ENOTFOUND|fetch failed|network/i.test(roh)) {
    return "Die Verbindung zur Dateiablage kam nicht zustande. Bitte erneut versuchen.";
  }

  const kurz = roh.trim().replace(/\s+/g, " ");
  if (!kurz) return "Der Grund ließ sich nicht ermitteln.";
  return kurz.length > MAX_LAENGE ? `${kurz.slice(0, MAX_LAENGE - 1)}…` : kurz;
}
