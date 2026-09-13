import { describe, expect, it } from "vitest";
import {
  erkenneThema,
  gesperrtePersonen,
  pruefeStimmverbot,
  type Beteiligte,
} from "./stimmverbot";
import { MEETING_AGENDA_TEMPLATES } from "./meeting-agenda-templates";

// Der Befund, um den es geht — wörtlich aus dem Produkttest:
//
//   „WEG mit Selbstverwaltung, bei der ein Eigentümer (Max Mustermann, WE 01)
//    gleichzeitig als Verwalter bestellt ist. TOP „Entlastung der Verwaltung".
//    Für genau diesen Eigentümer eine Stimme „Ja" eintragen. → Das System nimmt
//    die Stimme kommentarlos an und zählt sie mit ins Ergebnis."
//
// § 25 Abs. 4 WEG schließt ihn davon aus: Die Entlastung ist ein negatives
// Schuldanerkenntnis (§ 397 Abs. 2 BGB) und damit ein Rechtsgeschäft mit ihm.

const VERWALTER = "user-max";
const BEIRAT = "user-erika";
const NORMAL = "user-lisa";

const beteiligte: Beteiligte = {
  verwalterIds: [VERWALTER],
  beiratsIds: [BEIRAT],
};

describe("erkenneThema", () => {
  it("liest den Vorlagenschlüssel — die verlässliche Quelle", () => {
    expect(erkenneThema({ templateKey: "ENTLASTUNG_VERWALTUNG" })).toBe("ENTLASTUNG_VERWALTUNG");
    expect(erkenneThema({ templateKey: "ENTLASTUNG_BEIRAT" })).toBe("ENTLASTUNG_BEIRAT");
    expect(erkenneThema({ templateKey: "VERWALTERBESTELLUNG" })).toBe("VERWALTERBESTELLUNG");
  });

  it("zählt einen umbenannten TOP weiterhin richtig", () => {
    // Der Titel ist nach dem Übernehmen frei änderbar. Genau deshalb hängt die
    // Sperre am Schlüssel und nicht am Titel.
    expect(
      erkenneThema({ templateKey: "ENTLASTUNG_VERWALTUNG", title: "TOP 5 — Formalie" }),
    ).toBe("ENTLASTUNG_VERWALTUNG");
  });

  it("erkennt den alten gemeinsamen Schlüssel aus dem Bestand", () => {
    expect(erkenneThema({ templateKey: "ENTLASTUNG" })).toBe("ENTLASTUNG_VERWALTUNG");
  });

  it("fällt bei handgeschriebenen TOPs auf den Titel zurück", () => {
    expect(erkenneThema({ title: "Entlastung der Verwaltung für 2025" })).toBe(
      "ENTLASTUNG_VERWALTUNG",
    );
    expect(erkenneThema({ title: "Entlastung des Verwaltungsbeirats" })).toBe("ENTLASTUNG_BEIRAT");
    expect(erkenneThema({ title: "Bestellung der Verwaltung" })).toBe("VERWALTERBESTELLUNG");
    // Der gemeinsame Titel aus dem Bestand nennt beide Kreise. „Beirat" gewinnt
    // (siehe `erkenneThema`) — die engere Sperre ist hier die richtige.
    expect(erkenneThema({ title: "Entlastung der Verwaltung / des Verwaltungsbeirats" })).toBe(
      "ENTLASTUNG_BEIRAT",
    );
    expect(erkenneThema({ title: "Wahl der Verwalterin" })).toBe("VERWALTERBESTELLUNG");
  });

  it("bleibt eng: „Verwaltung“ allein ist noch kein Thema", () => {
    // Ein falscher Treffer nimmt jemandem sein Stimmrecht. Im Zweifel deshalb
    // lieber nichts erkennen.
    expect(erkenneThema({ title: "Verwaltungskosten 2026" })).toBeNull();
    expect(erkenneThema({ title: "Beschluss über die Hausordnung" })).toBeNull();
    expect(erkenneThema({ title: "" })).toBeNull();
    expect(erkenneThema({})).toBeNull();
  });
});

describe("pruefeStimmverbot", () => {
  it("sperrt den Verwalter bei seiner eigenen Entlastung", () => {
    const b = pruefeStimmverbot("ENTLASTUNG_VERWALTUNG", VERWALTER, beteiligte);
    expect(b?.gesperrt).toBe(true);
    expect(b?.grund).toContain("§ 25 Abs. 4 WEG");
  });

  it("sperrt ein Beiratsmitglied bei der Entlastung des Beirats", () => {
    expect(pruefeStimmverbot("ENTLASTUNG_BEIRAT", BEIRAT, beteiligte)?.gesperrt).toBe(true);
  });

  // Der Grund, warum die Vorlage in ZWEI Punkte zerlegt wurde: Über Kreuz
  // dürfen beide mitstimmen. Bei einem gemeinsamen TOP wäre in einer kleinen
  // Gemeinschaft womöglich niemand mehr übrig.
  it("lässt den Beirat über die Entlastung der Verwaltung mitstimmen", () => {
    expect(pruefeStimmverbot("ENTLASTUNG_VERWALTUNG", BEIRAT, beteiligte)).toBeNull();
  });

  it("lässt den Verwalter über die Entlastung des Beirats mitstimmen", () => {
    expect(pruefeStimmverbot("ENTLASTUNG_BEIRAT", VERWALTER, beteiligte)).toBeNull();
  });

  it("lässt gewöhnliche Eigentümer in Ruhe", () => {
    expect(pruefeStimmverbot("ENTLASTUNG_VERWALTUNG", NORMAL, beteiligte)).toBeNull();
    expect(pruefeStimmverbot("ENTLASTUNG_BEIRAT", NORMAL, beteiligte)).toBeNull();
  });

  it("greift bei einem Beschluss ohne erkanntes Thema gar nicht", () => {
    expect(pruefeStimmverbot(null, VERWALTER, beteiligte)).toBeNull();
  });

  // Bewusste Abgrenzung: Ob das Stimmverbot bei der Bestellung greift, ist
  // umstritten (organisationsrechtlicher Akt vs. Verwaltervertrag). Eine Sperre
  // machte einen zulässigen Fall unmöglich — deshalb nur ein Hinweis.
  it("warnt bei der Verwalterbestellung, sperrt aber nicht", () => {
    const b = pruefeStimmverbot("VERWALTERBESTELLUNG", VERWALTER, beteiligte);
    expect(b).not.toBeNull();
    expect(b!.gesperrt).toBe(false);
    expect(b!.grund).toContain("umstritten");
  });

  it("erkennt einen externen Verwalter ohne Eigentum gar nicht erst", () => {
    // `verwalterIds` enthält nur Verwalter, die zugleich Eigentümer sind — wer
    // kein Eigentum hält, hat ohnehin kein Stimmrecht.
    const ohne: Beteiligte = { verwalterIds: [], beiratsIds: [] };
    expect(pruefeStimmverbot("ENTLASTUNG_VERWALTUNG", VERWALTER, ohne)).toBeNull();
  });
});

describe("gesperrtePersonen", () => {
  it("nennt je Thema den betroffenen Personenkreis", () => {
    expect(gesperrtePersonen("ENTLASTUNG_VERWALTUNG", beteiligte)).toEqual([VERWALTER]);
    expect(gesperrtePersonen("ENTLASTUNG_BEIRAT", beteiligte)).toEqual([BEIRAT]);
  });

  it("sperrt bei der Bestellung niemanden vorab", () => {
    expect(gesperrtePersonen("VERWALTERBESTELLUNG", beteiligte)).toEqual([]);
    expect(gesperrtePersonen(null, beteiligte)).toEqual([]);
  });
});

describe("Vorlagenkatalog", () => {
  // Der gemeinsame TOP „Entlastung der Verwaltung / des Verwaltungsbeirats"
  // hätte in einer kleinen Selbstverwaltung Verwalter UND Beirat auf einmal
  // ausgeschlossen. Getrennt abgestimmt, bleibt jeder Punkt beschlussfähig.
  it("führt Entlastung getrennt nach Verwaltung und Beirat", () => {
    const keys = MEETING_AGENDA_TEMPLATES.map((t) => t.key);
    expect(keys).toContain("ENTLASTUNG_VERWALTUNG");
    expect(keys).toContain("ENTLASTUNG_BEIRAT");
    expect(keys).not.toContain("ENTLASTUNG");
  });

  it("weist in beiden Entlastungs-Vorlagen auf das Stimmverbot hin", () => {
    for (const key of ["ENTLASTUNG_VERWALTUNG", "ENTLASTUNG_BEIRAT"]) {
      const tpl = MEETING_AGENDA_TEMPLATES.find((t) => t.key === key)!;
      expect(tpl.description, key).toContain("§ 25 Abs. 4 WEG");
    }
  });

  it("erkennt jede Beschluss-Vorlage, deren Thema eine Rolle spielt", () => {
    // Gegenprobe gegen ein stilles Auseinanderlaufen: Wer eine Vorlage
    // umbenennt, ohne `erkenneThema` mitzuziehen, schaltet die Sperre ab.
    for (const key of ["ENTLASTUNG_VERWALTUNG", "ENTLASTUNG_BEIRAT", "VERWALTERBESTELLUNG"]) {
      expect(MEETING_AGENDA_TEMPLATES.some((t) => t.key === key), key).toBe(true);
      expect(erkenneThema({ templateKey: key }), key).not.toBeNull();
    }
  });
});
