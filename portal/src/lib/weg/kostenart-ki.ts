// KI-Vorschlag für die Kostenart einer importierten Ausgabe — die **zweite**
// Stufe, nicht die erste.
//
// Gefragt wird das Modell nur für die Zeilen, für die die Regeln in
// `zuordnung-vorschlag.ts` nichts gefunden haben: kein bekannter Zahlungspartner,
// kein ähnlicher Verwendungszweck. Bei einer Hausverwaltung ist das der
// Neuzugang — beim zweiten Mal trägt die Historie.
//
// **Was hinausgeht, ist bewusst wenig:** der von Zahlen, Beträgen und IBANs
// bereinigte Verwendungszweck und die Liste der Kostenart-Namen des Objekts.
// Kein Zahlungspartner, kein Betrag, kein Datum, keine Kontonummer, keine
// Einheit, kein Eigentümername. Ein Verwendungszweck kann trotzdem einen Namen
// enthalten — deshalb ist die Funktion standardmäßig aus und braucht eine
// eigene Freigabe (AI_KOSTENART_ENABLED), nicht die der anderen KI-Funktionen.
//
// Gebucht wird davon nichts: Der Vorschlag kommt als „unsicher" in die Vorschau
// und wird nur übernommen, wenn der Verwalter diesen Gütegrad ausdrücklich
// bestätigt. Fehler oder fehlender Schlüssel = kein Vorschlag, nie ein Abbruch.

/** Höchstzahl verschiedener Verwendungszwecke je Anfrage — eine Anfrage, nicht 391. */
const MAX_ZWECKE = 40;

/**
 * Entfernt aus einem Verwendungszweck alles, was eine Person oder ein Konto
 * bezeichnen kann: IBANs, Referenz- und Rechnungsnummern, Beträge, Daten —
 * kurz jedes Wort mit einer Ziffer. Übrig bleibt die Bezeichnung der Leistung,
 * und nur die trägt zur Kostenart bei.
 */
export function bereinigeZweck(zweck: string): string {
  return zweck
    // IBAN, auch in Vierergruppen geschrieben. Die Gruppen sind bewusst eng
    // gefasst: Ein loses `[A-Z0-9 ]{10,34}` verschluckte das nächste Wort mit.
    .replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4})+(?: ?[A-Z0-9]{1,3})?/g, " ")
    .split(/\s+/)
    .filter((wort) => wort.length > 1 && !/\d/.test(wort))
    .join(" ")
    .replace(/[^\p{L}\s.\-/&]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Ist die Funktion überhaupt freigegeben? Ohne Freigabe passiert nichts. */
export function kiKostenartAktiv(): boolean {
  return process.env.AI_KOSTENART_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Ordnet Verwendungszwecke den Kostenarten des Objekts zu.
 *
 * Rückgabe: bereinigter Zweck → Kostenart-ID. Nicht zuordenbare Zwecke fehlen
 * in der Karte; eine leere Karte ist das normale Ergebnis, wenn die Funktion
 * aus ist.
 */
export async function klassifiziereKostenarten(
  zwecke: string[],
  kostenarten: { id: string; name: string }[],
): Promise<Map<string, string>> {
  const leer = new Map<string, string>();
  if (!kiKostenartAktiv() || kostenarten.length === 0) return leer;

  const bereinigt = [...new Set(zwecke.map(bereinigeZweck).filter((z) => z.length >= 4))].slice(
    0,
    MAX_ZWECKE,
  );
  if (bereinigt.length === 0) return leer;

  const key = process.env.GEMINI_API_KEY as string;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const namen = kostenarten.map((k) => k.name);

  const prompt =
    `Du ordnest Buchungstexte einer deutschen Wohnungseigentümergemeinschaft den ` +
    `vorhandenen Kostenarten zu.\n` +
    `Erlaubte Kostenarten (genau so schreiben): ${namen.join(" | ")}\n` +
    `Passt keine, antworte für diese Zeile "NONE". Rate nicht.\n` +
    `Antworte als JSON-Liste mit je "index" (Zeilennummer, beginnend bei 0) und ` +
    `"kostenart".\n\n` +
    bereinigt.map((z, i) => `${i}: ${z}`).join("\n");

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer" },
                  kostenart: { type: "string", enum: [...namen, "NONE"] },
                },
                required: ["index", "kostenart"],
              },
            },
          },
        }),
      },
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return leer;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return leer;
    const antwort = JSON.parse(text) as unknown;
    if (!Array.isArray(antwort)) return leer;

    const nachName = new Map(kostenarten.map((k) => [k.name, k.id]));
    const treffer = new Map<string, string>();
    for (const eintrag of antwort) {
      if (!eintrag || typeof eintrag !== "object") continue;
      const { index, kostenart } = eintrag as { index?: unknown; kostenart?: unknown };
      if (typeof index !== "number" || !Number.isInteger(index)) continue;
      const zweck = bereinigt[index];
      const id = typeof kostenart === "string" ? nachName.get(kostenart) : undefined;
      // Alles, was nicht auf eine Kostenart **dieses Objekts** zeigt, fliegt
      // raus — eine erfundene Bezeichnung darf keinen Vorschlag erzeugen.
      if (zweck && id) treffer.set(zweck, id);
    }
    return treffer;
  } catch {
    return leer;
  }
}
