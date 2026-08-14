import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ablageFehler, ablageFehlerText } from "./ablage-fehler";

// Der Befund, der diesen Test veranlasst hat: Ein Wirtschaftsplan wurde
// beschlossen, 90 Sollstellungen entstanden — und die neun Einzelwirtschafts-
// pläne landeten nicht in den Dokumenten. Die Oberfläche meldete „konnten nicht
// abgelegt werden", ohne Grund und ohne Weg nach vorn; der echte Fehler stand
// allein im Server-Log. Ein Vorgang, dessen Teilschritt still scheitert, fällt
// erst auf, wenn ein Eigentümer sein Dokument vermisst.
//
// Drei Dinge hält dieser Test fest: dass der Grund lesbar herauskommt, dass er
// nach Zuständigkeit gestaffelt ist (System / Datei / Verbindung), und dass ihn
// **jede** Ablagestelle des Portals durchreicht — nicht nur der Wirtschaftsplan,
// mit dem es anfing.

describe("ablageFehlerText", () => {
  it("nennt die Dateiablage als Ursache, wenn der Blob-Store fehlt", () => {
    const text = ablageFehlerText(
      new Error(
        "Dateien können nicht gespeichert werden: In Produktion muss Vercel Blob " +
          "konfiguriert sein (BLOB_READ_WRITE_TOKEN).",
      ),
    );
    expect(text).toMatch(/Dateiablage/);
    // Der Hinweis, dass es an der Einstellung liegt und nicht an den Daten —
    // sonst sucht der Verwalter den Fehler bei den Eigentümern.
    expect(text).toMatch(/Einstellung des Systems/);
  });

  it("bietet bei einem Zeitüberschreitung den erneuten Versuch an", () => {
    expect(ablageFehlerText(new Error("Transaction API error: timed out"))).toMatch(
      /erneuter Versuch/i,
    );
  });

  it("reicht unbekannte Fehler gekürzt durch, statt sie zu verschlucken", () => {
    const lang = new Error("x".repeat(500));
    const text = ablageFehlerText(lang);
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith("…")).toBe(true);
  });

  it("bleibt aussagefähig, wenn gar keine Meldung da ist", () => {
    expect(ablageFehlerText(new Error(""))).toMatch(/nicht ermitteln/);
  });

  it("gibt keine Stapelspur preis", () => {
    const err = new Error("Kaputt");
    err.stack = "Error: Kaputt\n    at /var/task/.next/server/chunks/1234.js:5:6";
    expect(ablageFehlerText(err)).toBe("Kaputt");
  });
});

// Die Wiederholung ist der zweite Teil des Fixes: Ohne sie bliebe nach einem
// Fehlschlag nur, den Plan erneut zu beschließen — und `resolvePlan` läuft nur
// für Entwürfe. Es gäbe also gar keinen Weg zurück.
describe("Ablage lässt sich in beiden Modulen wiederholen", () => {
  const wurzel = join(__dirname, "..", "..", "app", "(portal)", "verwaltung", "weg", "[propertyId]");
  const aktionsModule = [
    join(wurzel, "wirtschaftsplan", "actions.ts"),
    join(wurzel, "jahresabrechnung", "actions.ts"),
  ];

  it.each(aktionsModule)("%s bietet wiederholeAblage an", (pfad) => {
    expect(readFileSync(pfad, "utf8")).toMatch(/export async function wiederholeAblage/);
  });

  it.each(aktionsModule)("%s meldet den Grund an die Oberfläche", (pfad) => {
    const quelle = readFileSync(pfad, "utf8");
    // Nicht nur `ablage=fehler`, sondern der Grund dazu — genau das fehlte.
    expect(quelle).toMatch(/ablageFehlerText/);
    expect(quelle).toMatch(/grund=\$\{encodeURIComponent/);
  });
});

// ── Staffelung nach Zuständigkeit ───────────────────────────────────────────
// Der Nutzer muss aus dem Satz ableiten können, was er als Nächstes tun soll.
// Drei Antworten sind möglich, und sie schließen einander aus: nichts (System),
// eine andere Datei wählen, oder es noch einmal versuchen. Ein Satz, der das
// offenlässt, kostet genau so viel Zeit wie gar keine Meldung — man probiert
// dann alles der Reihe nach.
describe("ablageFehler unterscheidet, wer den Fehler beheben kann", () => {
  const faelle: Array<[string, string, "konfiguration" | "datei" | "netzwerk" | "unbekannt"]> = [
    [
      "fehlendes Token",
      "Dateien können nicht gespeichert werden: In Produktion muss Vercel Blob " +
        "konfiguriert sein (BLOB_READ_WRITE_TOKEN).",
      "konfiguration",
    ],
    [
      "öffentlicher Store",
      "Datei konnte nicht gespeichert werden. Der Vercel-Blob-Store muss als PRIVAT " +
        "angelegt sein. Details: access denied",
      "konfiguration",
    ],
    ["unerlaubter Dateityp", "Dateityp application/zip ist nicht erlaubt.", "datei"],
    ["zu große Datei", "Die Datei ist größer als 100 MB.", "datei"],
    ["leere Datei", "Die Datei ist leer.", "datei"],
    ["Zeitüberschreitung", "Transaction API error: timed out", "netzwerk"],
    ["abgerissene Verbindung", "fetch failed", "netzwerk"],
    ["alles Übrige", "Irgendetwas anderes", "unbekannt"],
  ];

  it.each(faelle)("%s → %s", (_name, meldung, erwartet) => {
    expect(ablageFehler(new Error(meldung)).art).toBe(erwartet);
  });

  // Die Grenzfälle, an denen die Reihenfolge der Prüfungen hängt.
  it("liest die 5-MB-Grenze ohne Blob-Store als Konfigurationsfehler", () => {
    // Sie klingt nach „Datei zu groß", ist aber keine: Mit eingerichteter
    // Ablage gehen 100 MB. Wer das als Dateifehler ausgibt, schickt den
    // Verwalter los, sein PDF zu verkleinern — und das ändert nichts.
    const fehler = ablageFehler(
      new Error("Für Dateien über 5 MB muss Vercel Blob konfiguriert sein (BLOB_READ_WRITE_TOKEN)."),
    );
    expect(fehler.art).toBe("konfiguration");
    expect(fehler.text).toMatch(/nicht an Ihrer Datei/);
  });

  it("sagt beim Dateifehler, dass eine andere Datei hilft", () => {
    const fehler = ablageFehler(new Error("Dateityp application/zip ist nicht erlaubt."));
    expect(fehler.text).toContain("application/zip");
    expect(fehler.text).toMatch(/andere Datei/);
  });

  it("hält auch den zusammengesetzten Dateifehler in der URL-Grenze", () => {
    const fehler = ablageFehler(new Error(`Dateityp ${"x".repeat(400)} ist nicht erlaubt.`));
    expect(fehler.art).toBe("datei");
    expect(fehler.text.length).toBeLessThanOrEqual(200);
  });
});

// ── Jede Ablagestelle nennt ihren Grund ─────────────────────────────────────
// Das war der eigentliche Befund: Die Übersetzung existierte, aber nur der
// Wirtschaftsplan benutzte sie. Die normalen Formulare fingen stumm
// (`catch {}`) und meldeten `?fehler=datei` — also „Ihre Datei ist schuld",
// auch wenn die Ablage gar nicht erreichbar war. Dieser Test hält fest, dass
// keine neue Ablagestelle in diesen Zustand zurückfällt.
describe("jede Upload-Stelle reicht den Grund an die Oberfläche", () => {
  const APP = join(__dirname, "..", "..", "app");

  // Begründete Ausnahmen — nicht mehr. Wer hier etwas einträgt, nimmt einer
  // Stelle die Meldung; das gehört begründet, nicht stillschweigend getan.
  const OHNE_OBERFLAECHE: Record<string, string> = {
    "api/inbound/email/route.ts":
      "Eingehende E-Mails haben keinen Menschen davor. Der Absender bekommt " +
      "keine Portal-Seite zu sehen; hier zählt allein das Server-Log.",
  };

  function ablageStellen(): string[] {
    return readdirSync(APP, { recursive: true, encoding: "utf8" })
      .filter((d) => (d.endsWith(".ts") || d.endsWith(".tsx")) && !d.includes(".test."))
      .filter((d) => {
        const inhalt = readFileSync(join(APP, d), "utf8");
        return /\bsave(Upload|Buffer)\(/.test(inhalt);
      })
      .map((d) => d.split("\\").join("/"));
  }

  it("findet die Ablagestellen überhaupt (sonst prüft der Test nichts)", () => {
    // Ein Suchmuster, das ins Leere läuft, ist ein grüner Test ohne Aussage.
    expect(ablageStellen().length).toBeGreaterThan(8);
  });

  it("führt keine Ausnahme für eine Datei, die es nicht mehr gibt", () => {
    // Sonst stünde die Regel dort still ab — der gefährlichere der beiden
    // Fehler, weil er wie Abdeckung aussieht.
    expect(Object.keys(OHNE_OBERFLAECHE).filter((p) => !ablageStellen().includes(p))).toEqual([]);
  });

  it.each(ablageStellen().filter((p) => !(p in OHNE_OBERFLAECHE)))(
    "%s übersetzt den Fehler",
    (pfad) => {
      expect(readFileSync(join(APP, pfad), "utf8")).toMatch(/ablageFehlerText/);
    },
  );
});

// Die Startprüfung gehört in `instrumentation.ts` und nirgendwo sonst: Next
// ruft `register()` einmal beim Serverstart auf. Ohne sie fällt eine fehlende
// Ablage erst beim ersten Upload eines Kunden auf — und dann ist der
// Wirtschaftsplan bereits beschlossen und die Dokumente fehlen.
describe("Startprüfung", () => {
  it("ist in instrumentation.ts eingehängt", () => {
    const quelle = readFileSync(join(__dirname, "..", "..", "instrumentation.ts"), "utf8");
    expect(quelle).toMatch(/export async function register\(/);
    expect(quelle).toMatch(/warnungAblageKonfiguration/);
  });
});
