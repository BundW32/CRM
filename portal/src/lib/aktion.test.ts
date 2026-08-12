// Die Willkommensaktion hat drei Grenzen (Code, Zeitraum, Plätze). Jede einzelne
// davon kann eine Aktion still zu einem Dauerrabatt machen, wenn sie nicht hält
// — deshalb steht hier für jede eine Gegenprobe.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  AKTIONS_CODE,
  AKTION_GRATIS_MONATE,
  AKTION_TRIAL_TAGE,
  aktionsEndeText,
  aktionsLink,
  aktionsPlaetze,
  aktionsStand,
  istAktionsCode,
  normalisiereAktionsCode,
} from "./aktion";

const urspruenglich = { ende: process.env.AKTION_ENDE, plaetze: process.env.AKTION_PLAETZE };

afterEach(() => {
  process.env.AKTION_ENDE = urspruenglich.ende;
  process.env.AKTION_PLAETZE = urspruenglich.plaetze;
});

function setzeAktion(ende: string, plaetze: number) {
  process.env.AKTION_ENDE = ende;
  process.env.AKTION_PLAETZE = String(plaetze);
}

describe("Aktionscode", () => {
  it("erkennt den Code, wie er weitererzählt wird", () => {
    // Der Code steht auf der Seite, wird abgeschrieben und weitergegeben; ein
    // Bindestrich oder eine Kleinschreibung darf die Aktion nicht kosten.
    for (const eingabe of ["PORTAL24", "portal24", "Portal24-", " portal 24 ", "portal-24"]) {
      expect(istAktionsCode(eingabe)).toBe(true);
    }
  });

  it("erkennt Ähnliches NICHT als Code", () => {
    for (const eingabe of ["", null, undefined, "PORTAL", "PORTAL242", "24PORTAL", "PORTAL23"]) {
      expect(istAktionsCode(eingabe)).toBe(false);
    }
  });

  it("normalisiert auf Großbuchstaben und Ziffern", () => {
    expect(normalisiereAktionsCode(" po/rtal_24! ")).toBe("PORTAL24");
    expect(normalisiereAktionsCode(null)).toBe("");
  });

  it("nimmt den Code in den Werbelink mit", () => {
    // Ohne Code im Link müsste er abgeschrieben werden — daran scheitern Aktionen.
    expect(aktionsLink()).toBe(`/registrieren?code=${AKTIONS_CODE}`);
  });
});

describe("Zeitraum", () => {
  it("läuft am letzten Tag noch und danach nicht mehr", () => {
    setzeAktion("2026-09-30", 50);
    // Spät am letzten Tag (Berliner Zeit) — muss noch gelten.
    expect(aktionsStand(0, new Date("2026-09-30T21:30:00Z"))).not.toBeNull();
    // Der Folgetag ist vorbei.
    expect(aktionsStand(0, new Date("2026-10-01T08:00:00Z"))).toBeNull();
  });

  it("zählt angebrochene Tage, mindestens einen", () => {
    setzeAktion("2026-09-30", 50);
    expect(aktionsStand(0, new Date("2026-09-28T10:00:00Z"))?.tageBisEnde).toBe(3);
    expect(aktionsStand(0, new Date("2026-09-30T23:00:00Z"))?.tageBisEnde).toBe(1);
  });

  it("nennt das Enddatum als den Tag, der beworben wird", () => {
    // Der Zeitpunkt liegt auf 23:59:59 UTC; in Europe/Berlin formatiert stünde
    // dort der FOLGETAG. Der Text muss den beworbenen Tag nennen.
    setzeAktion("2026-09-30", 50);
    expect(aktionsEndeText()).toBe("30.09.2026");
    expect(aktionsStand(0, new Date("2026-08-11T10:00:00Z"))?.endeText).toBe("30.09.2026");
  });

  it("fällt bei unbrauchbarem Enddatum auf die Vorgabe zurück, statt abzuschalten", () => {
    for (const murks of ["", "morgen", "2026-13-45", "30.09.2026"]) {
      process.env.AKTION_ENDE = murks;
      expect(aktionsEndeText()).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    }
  });
});

describe("Plätze", () => {
  it("gibt den letzten Platz noch her und schließt danach", () => {
    setzeAktion("2026-09-30", 50);
    const jetzt = new Date("2026-08-11T10:00:00Z");
    expect(aktionsStand(49, jetzt)?.restplaetze).toBe(1);
    expect(aktionsStand(50, jetzt)).toBeNull();
    expect(aktionsStand(51, jetzt)).toBeNull();
  });

  it("fällt bei unbrauchbarer Platzzahl auf die Vorgabe zurück", () => {
    for (const murks of ["", "viele", "0", "-5", "3,5"]) {
      process.env.AKTION_PLAETZE = murks;
      expect(aktionsPlaetze()).toBeGreaterThan(0);
    }
  });
});

describe("Was die Seiten zeigen", () => {
  it("nennt die Platzgrenze, nicht den Verbrauch", () => {
    // Entscheidung des Auftraggebers vom 11.08.2026: „nur 50 Plätze" — kein
    // „noch 37 von 50 frei". Der Zähler bleibt Mechanik der Sperre; stünde er
    // wieder im Text, verriete die Seite ihre Anmeldezahlen, und eine hohe
    // Restzahl arbeitete gegen die beworbene Knappheit. Ein Blick auf den
    // Quelltext genügt hier: `restplaetze` ist die EINE Größe, aus der sich ein
    // solcher Text bauen lässt.
    const quelle = readFileSync(
      new URL("../components/marketing/aktion.tsx", import.meta.url),
      "utf8",
    );
    // Der Warnhinweis im Kopf der Datei nennt den Namen bewusst — gezählt wird
    // deshalb nur, was außerhalb von Kommentaren steht.
    const ohneKommentare = quelle
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(ohneKommentare).not.toMatch(/restplaetze/);
  });
});

describe("Gratis-Monate und Testphase", () => {
  it("rechnet die beworbenen Monate in Trial-Tage um", () => {
    // Beides steht im Text („3 Monate") und in der Datenbank (trialEndsAt).
    // Läuft es auseinander, verspricht die Seite etwas anderes, als die
    // Registrierung gewährt.
    expect(AKTION_TRIAL_TAGE).toBe(AKTION_GRATIS_MONATE * 30);
  });

  it("liefert im Stand genau die Werte, mit denen geworben wird", () => {
    setzeAktion("2026-09-30", 50);
    const stand = aktionsStand(7, new Date("2026-08-11T10:00:00Z"));
    expect(stand).toMatchObject({
      code: AKTIONS_CODE,
      gratisMonate: AKTION_GRATIS_MONATE,
      trialTage: AKTION_TRIAL_TAGE,
      plaetze: 50,
      restplaetze: 43,
    });
  });
});
