import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";
import { TOUR_SCHRITTE, tourSchritteFuer, type TourRolle } from "./tour";

const ROLLEN: TourRolle[] = ["verwalter", "eigentuemer", "mieter"];
/** Jede Kombination, die es in der Wirklichkeit gibt. */
const LAGEN = ROLLEN.flatMap((rolle) =>
  [true, false].flatMap((selbstverwaltung) =>
    [true, false].map((mitAssistent) => ({ rolle, selbstverwaltung, mitAssistent })),
  ),
);

// Eine Führung, die auf ein Element zeigt, das es nicht mehr gibt, ist
// schlimmer als keine: Sie dunkelt die Seite ab und leuchtet ins Leere. Und
// gemerkt wird das erst, wenn jemand das Programm zum ersten Mal öffnet — also
// genau bei dem, dem es am meisten schaden würde.
//
// Deshalb hier die statische Gegenprobe: Jedes Ziel eines Schritts muss als
// `data-tour`-Marker im Quelltext stehen.

const wurzel = join(__dirname, "..", "..");
const dateien = globSync(["src/**/*.tsx"], { cwd: wurzel }).map((p: string) => join(wurzel, p));

/** Alle Marker, die irgendwo gesetzt werden — auch die abgeleiteten. */
function vorhandeneMarker(): Set<string> {
  const gefunden = new Set<string>();
  for (const f of dateien) {
    const quelle = readFileSync(f, "utf8");
    // Feste Marker: data-tour="name"
    for (const m of quelle.matchAll(/data-tour="([^"{]+)"/g)) gefunden.add(m[1]);
    // Abgeleitete Marker der Navigation: data-tour={`nav-${…}`}
    if (/data-tour=\{`nav-\$\{/.test(quelle)) gefunden.add("nav-*");
  }
  return gefunden;
}

describe("Geführte Einrichtung", () => {
  it("sieht überhaupt Dateien", () => {
    expect(dateien.length).toBeGreaterThan(50);
  });

  it("findet für jeden Schritt sein Ziel", () => {
    const marker = vorhandeneMarker();
    const ohneZiel = TOUR_SCHRITTE.filter((s) => s.ziel).filter((s) => {
      // Navigationsziele entstehen aus `app-nav.ts`; geprüft wird, dass die
      // Ableitung überhaupt existiert und der Menüpunkt dort steht.
      if (s.ziel!.startsWith("nav-")) return !marker.has("nav-*");
      return !marker.has(s.ziel!);
    });
    expect(ohneZiel.map((s) => s.ziel)).toEqual([]);
  });

  it("verweist nur auf Menüpunkte, die es gibt", () => {
    const nav = readFileSync(join(wurzel, "src/lib/app-nav.ts"), "utf8");
    const fehlend = TOUR_SCHRITTE.filter((s) => s.ziel?.startsWith("nav-")).filter((s) => {
      // `nav-verwaltung-weg` → href "/verwaltung/weg"
      const href = "/" + s.ziel!.slice(4).replace(/-/g, "/");
      return !nav.includes(`"${href}"`);
    });
    expect(fehlend.map((s) => s.ziel)).toEqual([]);
  });

  it("bleibt kurz genug, dass jemand sie zu Ende liest", () => {
    // Sieben Schritte ist die Grenze aus dem Plan. Wer sie überschreitet,
    // erklärt nicht mehr, sondern hält auf.
    // Gezählt wird, was jemand *tatsächlich* durchklickt — nicht die
    // Gesamtliste: Einige Schritte gibt es mehrfach, je Rolle und Kontotyp
    // einmal.
    for (const lage of LAGEN) {
      const gesehen = tourSchritteFuer(lage);
      expect(gesehen.length).toBeLessThanOrEqual(7);
      expect(gesehen.length).toBeGreaterThan(2);
      // Und die Begrüßung genau einmal — sonst steht am Anfang zweimal
      // dasselbe, mit unterschiedlicher Aussage.
      expect(gesehen.filter((s) => s.titel.startsWith("Willkommen"))).toHaveLength(1);
    }
    const zuLang = TOUR_SCHRITTE.filter((s) => s.text.length > 340);
    expect(zuLang.map((s) => s.titel)).toEqual([]);
  });

  it("spricht die Sprache eines Eigentümers", () => {
    // Prinzip 1 aus dem Plan: Fachbegriffe werden nicht umbenannt — aber die
    // Führung ist das eine, was jemand *vor* allem anderen liest. Wer hier auf
    // „Sollstellung" trifft, hat schon verloren. Erklärt werden Begriffe an der
    // Stelle, an der sie gebraucht werden (Glossar, LP3).
    const fachsprache = [/Sollstellung/i, /Abrechnungsspitze/i, /\bMEA\b/, /Umlageschlüssel/i, /§/];
    const treffer = TOUR_SCHRITTE.flatMap((s) =>
      fachsprache.filter((r) => r.test(s.text) || r.test(s.titel)).map((r) => `${s.titel}: ${r}`),
    );
    expect(treffer).toEqual([]);
  });

  it("nennt keine Menüpunkte beim Namen", () => {
    // Derselbe Menüpunkt heißt je nach Rolle und Kontotyp anders — `/verwaltung/weg`
    // ist mal „WEG-Finanzen", mal „Finanzen & Buchhaltung". Ein Text, der einen
    // davon zitiert, zeigt der Hälfte der Nutzer einen Namen, den sie nirgends
    // finden. Der Lichtkegel sagt ohnehin, wo es steht. Genau so stand es im
    // Screenshot-Durchgang auf dem Schirm: Text und beleuchteter Punkt trugen
    // verschiedene Namen.
    const nav = readFileSync(join(wurzel, "src/lib/app-nav.ts"), "utf8");
    // Auch die Gruppen-Überschriften. Die alte Fassung des Bereichsleisten-
    // Schritts zählte „Alltag, Stammdaten, WEG, Betrieb" auf — so heißen sie
    // nur beim professionellen Verwalter; Eigentümer und Mieter haben gar keine
    // Gruppen. Der Text stimmte für drei von vier Zielgruppen nicht.
    const titel = [...nav.matchAll(/(?:title|label): "([^"]+)"/g)].map((m) => m[1]);
    const treffer = TOUR_SCHRITTE.flatMap((s) =>
      titel.filter((t) => s.text.includes(`„${t}`)).map((t) => `${s.titel}: „${t}“`),
    );
    expect(treffer).toEqual([]);
  });

  it("verspricht den Wiederanlauf genau einmal — in der Mechanik", () => {
    // Der Schlusssatz „unter Konto neu starten" steht in `tour.tsx`, weil der
    // letzte Schritt je nach Kontotyp ein anderer ist. Stünde er zusätzlich in
    // einem Schritttext, läse man ihn zweimal — oder, schlimmer, gar nicht,
    // wenn ausgerechnet dieser Schritt herausgefiltert wird.
    const doppelt = TOUR_SCHRITTE.filter((s) => /Führung.*(neu|wieder)/i.test(s.text));
    expect(doppelt.map((s) => s.titel)).toEqual([]);
    const mechanik = readFileSync(join(wurzel, "src/components/tour.tsx"), "utf8");
    expect(mechanik).toMatch(/Führung starten Sie jederzeit neu/);
  });

  it("zeigt dem professionellen Verwalter keine Selbstverwalter-Schritte", () => {
    const profi = tourSchritteFuer({ rolle: "verwalter", selbstverwaltung: false, mitAssistent: true });
    const selbst = tourSchritteFuer({ rolle: "verwalter", selbstverwaltung: true, mitAssistent: true });
    expect(profi.length).toBeLessThan(selbst.length);
    expect(profi.every((s) => !s.nurSelbstverwaltung)).toBe(true);
  });

  it("zeigt niemandem einen Bereich, den seine Rolle nicht hat", () => {
    // **Der Test zu dem Fehler, der im Screenshot-Durchgang auffiel.** Max
    // Mieter bekam beim ersten Anmelden „Sie verwalten Ihre Gemeinschaft ab
    // jetzt selbst" zu lesen und danach drei leere Karten über Einrichtung,
    // Geld und Fristen — Bereiche, die in seinem Menü nicht vorkommen.
    //
    // Geprüft wird gegen `app-nav.ts`: Zeigt ein Schritt auf einen Menüpunkt,
    // muss dieser Menüpunkt in der Navigation **dieser Rolle** stehen.
    const nav = readFileSync(join(wurzel, "src/lib/app-nav.ts"), "utf8");
    const abschnitt = (von: string, bis: string) => {
      const a = nav.indexOf(von);
      const b = nav.indexOf(bis, a);
      return nav.slice(a, b === -1 ? undefined : b);
    };
    const menue: Record<TourRolle, string> = {
      // Beide Verwalter-Menüs zusammen: Welches gilt, entscheidet der Kontotyp,
      // und die betroffenen Schritte tragen ohnehin `nurSelbstverwaltung`.
      verwalter: abschnitt("function verwalterGroups", "function eigentuemerItems"),
      eigentuemer: abschnitt("function eigentuemerItems", "function mieterItems"),
      mieter: abschnitt("function mieterItems", "export function navFor"),
    };

    const fehler: string[] = [];
    for (const lage of LAGEN) {
      for (const s of tourSchritteFuer(lage)) {
        if (!s.ziel?.startsWith("nav-")) continue;
        const href = "/" + s.ziel.slice(4).replace(/-/g, "/");
        if (!menue[lage.rolle].includes(`"${href}"`)) {
          fehler.push(`${lage.rolle}: „${s.titel}" zeigt auf ${href}`);
        }
      }
    }
    expect(fehler).toEqual([]);
  });

  it("verspricht keinen Assistenten, wenn es keinen gibt", () => {
    // Ohne API-Schlüssel gibt es das Widget nicht. Ein Schritt, der es
    // anpreist, schickt den Nutzer auf eine vergebliche Suche.
    const ohne = tourSchritteFuer({ rolle: "verwalter", selbstverwaltung: true, mitAssistent: false });
    expect(ohne.some((s) => s.ziel === "assistent")).toBe(false);
  });
});
