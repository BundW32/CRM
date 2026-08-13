// Selbstprüfung der Dateiablage — Diagnose statt Raten.
//
// Anlass: In Produktion schlug **jeder** Upload fehl. Die Oberfläche sagte „Die
// Dateiablage ist nicht verfügbar", und damit endete die Spur. Ob nun das Token
// fehlte oder der Blob-Store öffentlich statt privat angelegt war, ließ sich von
// außen nicht unterscheiden — beide Ursachen sehen für den Nutzer gleich aus,
// brauchen aber gegensätzliche Handgriffe. Wer das nicht messen kann, probiert.
//
// Diese Prüfung misst: Token gesetzt? Testupload möglich? Wieder lesbar? Store
// wirklich privat? Und sie nennt bei jedem Fehlschlag den Behebungsschritt.
//
// **Keine Geheimnisse.** Der Befund zum Token lautet „gesetzt" oder „nicht
// gesetzt" — nie ein Präfix, nie eine Länge, nie ein Ausschnitt. Ein
// Diagnosewerkzeug, das Zugangsdaten in die Oberfläche schreibt, verwandelt
// jeden Screenshot in ein Leck; und für die Frage, ob die Ablage geht, ist der
// Wert des Tokens ohne Belang.
//
// Die Prüfung schreibt eine echte Datei. Anders geht es nicht: Ob ein Store
// `access: "private"` annimmt, steht in keiner Umgebungsvariablen — das sagt
// nur der Versuch. Die Datei wird danach wieder gelöscht.

import crypto from "crypto";
import { del, get, put } from "@vercel/blob";
import { ablageFehler } from "@/lib/weg/ablage-fehler";

/**
 * Name der Umgebungsvariablen — einmal benannt, überall verwendet.
 *
 * Die Oberfläche zeigt ihn an; sie darf ihn aber nicht abschreiben. Der Test
 * `lib/blob-abruf.test.ts` verlangt, dass jede Datei unter `src/app`, in der
 * `BLOB_READ_WRITE_TOKEN` steht, den Ziel-Host vor einem Abruf prüft — eine
 * Regel, die schon zweimal eine echte Lücke gefunden hat. Sie wegen einer
 * Beschriftung aufzuweichen wäre der falsche Handel.
 */
export const TOKEN_NAME = "BLOB_READ_WRITE_TOKEN";

export type PruefStatus = "ok" | "warnung" | "fehler";

export type PruefSchluessel = "token" | "schreiben" | "lesen" | "privat";

export type PruefPunkt = {
  schluessel: PruefSchluessel;
  titel: string;
  status: PruefStatus;
  /** Was gemessen wurde — ohne Geheimnisse. */
  befund: string;
  /** Was zu tun ist. Nur gesetzt, wenn etwas zu tun ist. */
  behebung?: string;
};

export type AblagePruefung = {
  /** Schlechtester Einzelstatus — das ist die Aussage der Seite. */
  gesamt: PruefStatus;
  /** `production` | `preview` | `development` (Vercel) oder `lokal`. */
  umgebung: string;
  punkte: PruefPunkt[];
};

/**
 * Die vier Handgriffe, mit denen die Prüfung die Außenwelt berührt.
 *
 * Als Schnittstelle herausgezogen, damit die Prüflogik selbst ohne Netz und
 * ohne Blob-Store testbar bleibt: Die interessanten Fälle sind die Fehlschläge,
 * und einen öffentlich angelegten Store kann man in der Prüfung nicht
 * herbeiführen — als Attrappe dagegen in einer Zeile.
 */
export type AblageSonden = {
  tokenGesetzt: () => boolean;
  umgebung: () => string;
  /** Legt die Testdatei ab und liefert ihre URL. */
  schreibe: (inhalt: Buffer, pfad: string) => Promise<string>;
  lies: (url: string) => Promise<Buffer>;
  /** Ist die Datei OHNE Zugangsdaten abrufbar? Dann ist der Store öffentlich. */
  oeffentlichAbrufbar: (url: string) => Promise<boolean>;
  loesche: (url: string) => Promise<void>;
};

export const echteSonden: AblageSonden = {
  tokenGesetzt: () => Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  umgebung: () => process.env.VERCEL_ENV ?? (process.env.VERCEL ? "unbekannt" : "lokal"),
  schreibe: async (inhalt, pfad) => {
    const blob = await put(pfad, inhalt, { access: "private", contentType: "text/plain" });
    return blob.url;
  },
  lies: async (url) => {
    const result = await get(url, { access: "private" });
    if (!result || result.statusCode !== 200) {
      throw new Error(`Abruf lieferte Status ${result?.statusCode ?? "ohne Antwort"}.`);
    }
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  },
  // Bewusst ein nackter `fetch` ohne Token: Genau das kann jeder Fremde auch.
  // Antwortet der Store hier mit 200, liegen sämtliche Kundendateien offen —
  // die Blob-URLs stehen in der Datenbank und in jedem geteilten Link.
  oeffentlichAbrufbar: async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok;
  },
  loesche: async (url) => {
    await del(url);
  },
};

const TITEL: Record<PruefSchluessel, string> = {
  token: "Zugangs-Token der Ablage",
  schreiben: "Testupload",
  lesen: "Rücklesen der Testdatei",
  privat: "Store ist privat",
};

/** Behebungsschritt für den häufigsten Fall — an drei Stellen wortgleich nötig. */
const STORE_ANLEGEN =
  "In Vercel einen Blob-Store mit Access „Private“ anlegen (Dashboard → Storage → " +
  "Create → Blob, oder `vercel blob create-store --access private`), mit dem Projekt " +
  "verbinden und neu deployen. Siehe docs/BETRIEB-Dateiablage.md.";

function schlechtester(punkte: PruefPunkt[]): PruefStatus {
  if (punkte.some((p) => p.status === "fehler")) return "fehler";
  if (punkte.some((p) => p.status === "warnung")) return "warnung";
  return "ok";
}

function uebersprungen(schluessel: PruefSchluessel, grund: string): PruefPunkt {
  return { schluessel, titel: TITEL[schluessel], status: "warnung", befund: `Nicht geprüft: ${grund}` };
}

/**
 * Führt die Selbstprüfung durch. Reihenfolge ist Absicht: Ohne Token gibt es
 * keinen Store, ohne geschriebene Datei nichts zu lesen. Was nicht geprüft
 * werden konnte, wird als „nicht geprüft" ausgewiesen — nicht als „in Ordnung".
 * Ein übersprungener Punkt, der grün aussieht, ist schlimmer als gar keine
 * Prüfung.
 */
export async function pruefeAblage(sonden: AblageSonden = echteSonden): Promise<AblagePruefung> {
  const umgebung = sonden.umgebung();
  const punkte: PruefPunkt[] = [];

  // ── 1. Token ──────────────────────────────────────────────────────────────
  if (!sonden.tokenGesetzt()) {
    const inProduktion = umgebung === "production";
    punkte.push({
      schluessel: "token",
      titel: TITEL.token,
      status: inProduktion ? "fehler" : "warnung",
      befund: inProduktion
        ? `${TOKEN_NAME} ist nicht gesetzt. In Produktion bricht damit jeder ` +
          "Upload ab — Belege, Fotos, Wirtschaftspläne, Jahresabrechnungen."
        : `${TOKEN_NAME} ist nicht gesetzt. Außerhalb der Produktion greift der ` +
          "Data-URL-Fallback (Datei in der Datenbank, höchstens 5 MB); in Produktion " +
          "wäre dieselbe Lage ein harter Abbruch.",
      behebung: STORE_ANLEGEN,
    });
    const grund = "ohne Token gibt es keinen Blob-Store, an dem sich etwas messen ließe.";
    punkte.push(uebersprungen("schreiben", grund), uebersprungen("lesen", grund), uebersprungen("privat", grund));
    return { gesamt: schlechtester(punkte), umgebung, punkte };
  }

  punkte.push({
    schluessel: "token",
    titel: TITEL.token,
    status: "ok",
    // Bewusst nur „gesetzt" — kein Wert, kein Präfix, keine Länge.
    befund: `${TOKEN_NAME} ist gesetzt.`,
  });

  // ── 2. Testupload ─────────────────────────────────────────────────────────
  const inhalt = Buffer.from(`selbsttest ${new Date().toISOString()}`, "utf8");
  const pfad = `selbsttest/ablage-${crypto.randomUUID()}.txt`;
  let url: string;
  try {
    url = await sonden.schreibe(inhalt, pfad);
  } catch (err) {
    const { art, text } = ablageFehler(err);
    punkte.push({
      schluessel: "schreiben",
      titel: TITEL.schreiben,
      status: "fehler",
      befund: `Der Testupload schlug fehl: ${text}`,
      // Ein Store, der `access: "private"` abweist, ist öffentlich angelegt.
      // Das ist der zweite der beiden Produktionsfälle und der unauffälligere:
      // Das Token ist gesetzt, alles sieht eingerichtet aus — und trotzdem geht
      // kein Upload durch.
      behebung:
        art === "netzwerk"
          ? "Vorübergehende Störung möglich — Prüfung wiederholen. Bleibt es dabei, den " +
            "Status von Vercel Blob prüfen."
          : STORE_ANLEGEN,
    });
    punkte.push(
      uebersprungen("lesen", "es wurde keine Testdatei abgelegt."),
      uebersprungen("privat", "es wurde keine Testdatei abgelegt."),
    );
    return { gesamt: schlechtester(punkte), umgebung, punkte };
  }

  punkte.push({
    schluessel: "schreiben",
    titel: TITEL.schreiben,
    status: "ok",
    befund: "Eine Testdatei wurde privat abgelegt (access: private).",
  });

  // ── 3. Rücklesen ──────────────────────────────────────────────────────────
  // Schreiben allein genügt nicht: Ein Upload, der ankommt und sich nicht wieder
  // abrufen lässt, ist für den Eigentümer dasselbe wie kein Upload.
  try {
    const zurueck = await sonden.lies(url);
    punkte.push({
      schluessel: "lesen",
      titel: TITEL.lesen,
      status: zurueck.equals(inhalt) ? "ok" : "fehler",
      befund: zurueck.equals(inhalt)
        ? "Die Testdatei kam unverändert zurück."
        : "Die Testdatei kam verändert zurück — der Abruf liefert nicht, was abgelegt wurde.",
      ...(zurueck.equals(inhalt) ? {} : { behebung: STORE_ANLEGEN }),
    });
  } catch (err) {
    punkte.push({
      schluessel: "lesen",
      titel: TITEL.lesen,
      status: "fehler",
      befund: `Die Testdatei ließ sich nicht zurücklesen: ${ablageFehler(err).text}`,
      behebung:
        "Dateien werden abgelegt, sind aber nicht abrufbar. Token-Rechte (Read/Write) und " +
        "Store-Verbindung des Projekts prüfen.",
    });
  }

  // ── 4. Privat? ────────────────────────────────────────────────────────────
  try {
    const offen = await sonden.oeffentlichAbrufbar(url);
    punkte.push({
      schluessel: "privat",
      titel: TITEL.privat,
      status: offen ? "fehler" : "ok",
      befund: offen
        ? "Die Testdatei war OHNE Anmeldung abrufbar. Der Store ist öffentlich — damit " +
          "liegen alle Kundendateien offen, deren URL bekannt ist."
        : "Ohne Zugangsdaten nicht abrufbar — der Store ist privat.",
      ...(offen
        ? {
            behebung:
              "Privaten Store anlegen, Projekt darauf umstellen, bestehende Dateien " +
              "übertragen und den öffentlichen Store löschen. " +
              STORE_ANLEGEN,
          }
        : {}),
    });
  } catch {
    // Der Abruf ohne Token soll scheitern — ein geworfener Fehler ist hier
    // kein Befund, sondern die Regel. Nur ein glatter 200 wäre der Alarm.
    punkte.push({
      schluessel: "privat",
      titel: TITEL.privat,
      status: "ok",
      befund: "Ohne Zugangsdaten nicht abrufbar — der Store ist privat.",
    });
  }

  // Aufräumen: Die Testdatei hat keinen Zweck über die Prüfung hinaus. Schlägt
  // das Löschen fehl, bleibt eine winzige Textdatei liegen — kein Befund, den
  // ein Betreiber sehen müsste.
  await sonden.loesche(url).catch(() => {});

  return { gesamt: schlechtester(punkte), umgebung, punkte };
}

/**
 * Startprüfung: Warnt beim Serverstart, wenn Produktion ohne Dateiablage läuft.
 *
 * Pur und ohne Seiteneffekt, damit sie prüfbar ist — der Aufrufer ist
 * `src/instrumentation.ts`. Eine Fehlkonfiguration, die erst beim ersten Upload
 * eines Kunden auffällt, fällt zu spät auf: Bis dahin hat jemand einen
 * Wirtschaftsplan beschlossen, dessen Dokumente nie ankamen.
 */
export function warnungAblageKonfiguration(env: Record<string, string | undefined>): string | null {
  if (env.VERCEL_ENV !== "production") return null;
  if (env.BLOB_READ_WRITE_TOKEN) return null;
  return (
    `[Ablage] ${TOKEN_NAME} ist in Produktion NICHT gesetzt. ` +
    "Jeder Upload wird fehlschlagen (Belege, Fotos, Wirtschaftspläne, Jahresabrechnungen), " +
    "und der Data-URL-Fallback ist in Produktion absichtlich gesperrt. " +
    STORE_ANLEGEN
  );
}
