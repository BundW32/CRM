import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_DESKTOP,
  BUDGET_MOBIL,
  FENSTER_RADIUS,
  FENSTER_SEITEN,
  MAX_AUFLOESUNG,
  MAX_LEINWAND_FLAECHE,
  MAX_LEINWAND_KANTE,
  MIN_AUFLOESUNG,
  RUECKFRAGE_SEITEN,
  imFenster,
  pixelBudget,
  renderAufloesung,
  renderSchlange,
  rueckfrageNoetig,
  seiteBeiHoehe,
} from "./pdf-vorschau";

// Die Zahlen unten sind keine Geschmacksfrage: Der gemessene Absturz lag bei
// 2.249 Megapixeln gleichzeitig belegter Leinwand (150 Seiten, Zoom 3×). Was
// hier geprüft wird, ist die Frage, ob dieselbe Rechnung heute darunter bleibt.

/** So viel Bitmap belegt ein Fenster voller Seiten bei dieser Auflösung. */
function megapixelImFenster(cssBreite: number, cssHoehe: number, budget: number): number {
  const aufloesung = renderAufloesung({
    cssBreite,
    cssHoehe,
    geraeteRatio: 3,
    budget,
  });
  return (cssBreite * aufloesung * (cssHoehe * aufloesung) * FENSTER_SEITEN) / 1e6;
}

describe("pixelBudget", () => {
  it("ist auf dem Telefon strenger als am Schreibtisch", () => {
    expect(pixelBudget(390)).toBe(BUDGET_MOBIL);
    expect(pixelBudget(1440)).toBe(BUDGET_DESKTOP);
    expect(pixelBudget(390)).toBeLessThan(pixelBudget(1440));
  });
});

describe("renderAufloesung", () => {
  const a4 = (breite: number) => ({ cssBreite: breite, cssHoehe: breite * 1.414 });

  it("nimmt die Gerätepixel, solange das Budget es hergibt", () => {
    // Telefon, Breite füllend: hier soll es scharf bleiben.
    const r = renderAufloesung({ ...a4(366), geraeteRatio: 3, budget: BUDGET_MOBIL });
    expect(r).toBe(MAX_AUFLOESUNG);
  });

  it("bremst bei starkem Zoom, statt die Fläche neunfach zu nehmen", () => {
    const ohneZoom = renderAufloesung({ ...a4(860), geraeteRatio: 3, budget: BUDGET_DESKTOP });
    const mitZoom = renderAufloesung({ ...a4(860 * 3), geraeteRatio: 3, budget: BUDGET_DESKTOP });
    expect(mitZoom).toBeLessThan(ohneZoom);
  });

  it("hält das Budget in jeder Zoomstufe ein — auch am Schreibtisch", () => {
    for (const zoom of [0.75, 1, 1.5, 2, 3]) {
      const { cssBreite, cssHoehe } = a4(860 * zoom);
      expect(megapixelImFenster(cssBreite, cssHoehe, BUDGET_DESKTOP)).toBeLessThanOrEqual(
        BUDGET_DESKTOP / 1e6,
      );
    }
  });

  it("hält das Budget in jeder Zoomstufe ein — auch auf dem Telefon", () => {
    for (const zoom of [0.75, 1, 1.5, 2, 3]) {
      const { cssBreite, cssHoehe } = a4(366 * zoom);
      expect(megapixelImFenster(cssBreite, cssHoehe, BUDGET_MOBIL)).toBeLessThanOrEqual(
        BUDGET_MOBIL / 1e6,
      );
    }
  });

  it("bleibt unter der Leinwandgrenze des Browsers, auch wenn das Budget mehr erlaubte", () => {
    // Sehr große Fläche bei riesigem Budget: jetzt zählt nur noch die
    // Browser-Vorgabe. Darüber liefert iOS Safari eine leere Leinwand.
    const cssBreite = 4000;
    const cssHoehe = 5656;
    const r = renderAufloesung({
      cssBreite,
      cssHoehe,
      geraeteRatio: 3,
      budget: 10_000_000_000,
    });
    expect(cssBreite * r).toBeLessThanOrEqual(MAX_LEINWAND_KANTE + 0.001);
    expect(cssHoehe * r).toBeLessThanOrEqual(MAX_LEINWAND_KANTE + 0.001);
    expect(cssBreite * r * cssHoehe * r).toBeLessThanOrEqual(MAX_LEINWAND_FLAECHE + 1);
  });

  it("drückt die Schrift nicht unter die Lesbarkeit — das Budget hat dort keinen Vorrang", () => {
    const r = renderAufloesung({
      cssBreite: 2000,
      cssHoehe: 2828,
      geraeteRatio: 3,
      budget: 1, // absichtlich absurd knapp
    });
    expect(r).toBe(MIN_AUFLOESUNG);
  });

  it("liefert eine brauchbare Zahl, solange der Platz noch nicht gemessen ist", () => {
    expect(renderAufloesung({ cssBreite: 0, cssHoehe: 0, geraeteRatio: 2, budget: 1e8 })).toBe(1);
  });
});

describe("imFenster", () => {
  it("hält nur Seiten um die aktuelle herum", () => {
    expect(imFenster(10, 10)).toBe(true);
    expect(imFenster(10 - FENSTER_RADIUS, 10)).toBe(true);
    expect(imFenster(10 + FENSTER_RADIUS, 10)).toBe(true);
    expect(imFenster(10 + FENSTER_RADIUS + 1, 10)).toBe(false);
    expect(imFenster(1, 10)).toBe(false);
  });

  it("deckelt die Zahl gleichzeitig belegter Leinwände unabhängig von der Seitenzahl", () => {
    for (const seitenZahl of [40, 150, 500]) {
      const belegt = Array.from({ length: seitenZahl }, (_, i) => i + 1).filter((s) =>
        imFenster(s, 20),
      );
      expect(belegt.length).toBeLessThanOrEqual(FENSTER_SEITEN);
    }
  });
});

describe("seiteBeiHoehe", () => {
  // 150 Seiten zu je 3.636 px — die Maße aus dem gemessenen Fall, Zoom 3×.
  const hoehe = 3636;
  const oben = (i: number) => i * hoehe;

  it("findet die Seite unter der Mitte des Ausschnitts", () => {
    expect(seiteBeiHoehe(150, oben, 0)).toBe(1);
    expect(seiteBeiHoehe(150, oben, hoehe - 1)).toBe(1);
    expect(seiteBeiHoehe(150, oben, hoehe)).toBe(2);
    expect(seiteBeiHoehe(150, oben, 76 * hoehe + 5)).toBe(77);
  });

  it("bleibt auch dort richtig, wo eine Seite höher ist als der Ausschnitt", () => {
    // Genau der Fall, an dem der Beobachter-Weg gescheitert ist: Ein Ausschnitt
    // von 1.030 px sieht nie mehr als 28 % einer Seite.
    const ausschnitt = 1030;
    for (let schritt = 0; schritt < 300; schritt++) {
      const scrollTop = schritt * ausschnitt * 0.9;
      const erwartet = Math.floor((scrollTop + ausschnitt / 2) / hoehe) + 1;
      expect(seiteBeiHoehe(150, oben, scrollTop + ausschnitt / 2)).toBe(erwartet);
    }
  });

  it("bleibt innerhalb des Dokuments", () => {
    expect(seiteBeiHoehe(150, oben, -500)).toBe(1);
    expect(seiteBeiHoehe(150, oben, 10_000_000)).toBe(150);
    expect(seiteBeiHoehe(0, oben, 500)).toBe(1);
  });

  it("kommt mit ungleich hohen Seiten zurecht (Hoch- und Querformat gemischt)", () => {
    const kanten = [0, 1000, 1500, 4000, 4200];
    const von = (i: number) => kanten[i];
    expect(seiteBeiHoehe(kanten.length, von, 1200)).toBe(2);
    expect(seiteBeiHoehe(kanten.length, von, 3999)).toBe(3);
    expect(seiteBeiHoehe(kanten.length, von, 4100)).toBe(4);
  });
});

describe("rueckfrageNoetig", () => {
  it("fragt bei vielen Seiten", () => {
    expect(rueckfrageNoetig({ seiten: 38, bytes: 500_000 })).toBe(true);
    expect(rueckfrageNoetig({ seiten: RUECKFRAGE_SEITEN, bytes: 500_000 })).toBe(false);
  });

  it("fragt bei großer Datei, auch wenn es wenige Seiten sind", () => {
    // Gescannte Übergabeprotokolle: vier Seiten, aber als Foto eingescannt.
    expect(rueckfrageNoetig({ seiten: 4, bytes: 40 * 1024 * 1024 })).toBe(true);
  });

  it("lässt den Normalfall — eine Rechnung, ein Beleg — ungefragt durch", () => {
    expect(rueckfrageNoetig({ seiten: 2, bytes: 180_000 })).toBe(false);
  });
});

describe("renderSchlange", () => {
  it("lässt nie mehr als die erlaubte Zahl gleichzeitig laufen", async () => {
    const anstellen = renderSchlange(2);
    let laufend = 0;
    let hoechststand = 0;
    const freigeben: (() => void)[] = [];

    const aufgaben = Array.from({ length: 6 }, () =>
      anstellen(async () => {
        laufend++;
        hoechststand = Math.max(hoechststand, laufend);
        await new Promise<void>((fertig) => freigeben.push(fertig));
        laufend--;
      }),
    );

    // Nacheinander freigeben; nach jedem Schritt darf höchstens die Grenze laufen.
    for (let i = 0; i < aufgaben.length; i++) {
      while (freigeben.length === 0) await new Promise((r) => setTimeout(r, 0));
      expect(laufend).toBeLessThanOrEqual(2);
      freigeben.shift()!();
    }
    await Promise.all(aufgaben);
    expect(hoechststand).toBe(2);
  });

  it("hängt sich an einem gescheiterten Auftrag nicht auf", async () => {
    const anstellen = renderSchlange(1);
    const kaputt = anstellen(async () => {
      throw new Error("abgebrochen");
    });
    await expect(kaputt).rejects.toThrow("abgebrochen");
    // Der Platz muss wieder frei sein, sonst rendert die Vorschau nie wieder.
    await expect(anstellen(async () => "fertig")).resolves.toBe("fertig");
  });
});

// ── Aufräumen beim Schließen ────────────────────────────────────────────────
// Die Rechnungen oben halten den laufenden Betrieb im Rahmen. Sie genügten
// nicht: Der Tab starb weiterhin beim SCHLIESSEN der Vorschau. Beim Verlassen
// nimmt React die Leinwände aus dem Dokument, ihre Bitmaps gibt der Browser
// aber erst frei, wenn er die Elemente einsammelt — bis dahin liegen die Seiten
// des Fensters weiter im Prozess (beim Desktop-Budget mehrere hundert Megabyte)
// und addieren sich über mehrere Vorschauen auf.
//
// Was dieser Test kann und was nicht: Er hält fest, dass der Handgriff
// **dasteht** — nicht, dass der Speicher tatsächlich sinkt. Das ließe sich nur
// in einem echten Browser messen, und genau dort merkt man den Fehler erst,
// wenn der Tab weg ist. Für die Frage „ist das Freigeben beim nächsten Umbau
// versehentlich verschwunden?" ist er trotzdem die richtige Wache — dieselbe
// Bauart wie `versammlungsbeschluss.test.ts`.
describe("Vorschau gibt ihren Speicher beim Schließen frei", () => {
  const quelle = readFileSync(
    join(__dirname, "..", "components", "file-preview.tsx"),
    "utf8",
  );

  it("setzt die Leinwand beim Verlassen auf 0×0", () => {
    // Der Effekt muss OHNE Abhängigkeiten stehen: Mit `sichtbar`/`rendern`
    // liefe er bei jeder Zoomänderung mit und schaltete die sichtbare Seite
    // kurz auf weiß.
    const entlassEffekt = /useEffect\(\(\) => \{\s*const canvas = canvasRef\.current;\s*return \(\) => \{[^}]*canvas\.width = 0;[^}]*canvas\.height = 0;[^}]*\};\s*\},\s*\[\]\);/;
    expect(quelle).toMatch(entlassEffekt);
  });

  it("schließt Dokument und Worker beim Verlassen", () => {
    // `destroy()` beendet den pdf.js-Worker. Ohne den Aufruf bliebe je
    // geöffneter Vorschau ein Worker samt Dokumentpuffer stehen.
    //
    // Zerstört wird der LADEAUFTRAG, nicht das Dokument: Seit pdf.js 6 trägt
    // `PDFDocumentProxy` kein `destroy()` mehr. Der frühere `loaded?.destroy()`
    // warf deshalb einen TypeError — und weil das in einer Aufräumfunktion
    // geschah, reichte React ihn nach oben, wo er mangels Error-Boundary die
    // GANZE Anwendung durch die Fehlerseite von Next.js ersetzte. Der Test
    // steht bewusst auf `loadingTask`, damit niemand versehentlich auf das
    // Dokument zurückfällt.
    expect(quelle).toMatch(/loadingTask\?\.destroy\(\)/);
    expect(quelle).not.toMatch(/loaded\?\.destroy\(\)/);
  });

  it("fängt die Ablehnung aus `destroy` ab", () => {
    // Läuft beim Schließen noch ein Auftrag, lehnt `destroy()` ab. Unbehandelt
    // stünde das als Fehler in der Konsole und sähe aus wie ein Defekt.
    expect(quelle).toMatch(/destroy\(\)\.catch\(/);
  });
});
