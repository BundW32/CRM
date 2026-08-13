import { describe, expect, it } from "vitest";
import type { StatementBefund } from "./annual-statement";
import type { KontoAbstimmung } from "./kontenabstimmung";
import { bauePruefliste } from "./pruefliste";

function konto(over: Partial<KontoAbstimmung> = {}): KontoAbstimmung {
  return {
    accountId: "giro",
    name: "Girokonto",
    kind: "GIRO",
    endCents: 1_000_000,
    reportedEndCents: 1_000_000,
    diffCents: 0,
    stimmt: true,
    satz: "Kontoauszug und Buchungen stimmen auf den Cent überein.",
    verdachte: [],
    ...over,
  };
}

const befund = (over: Partial<StatementBefund> = {}): StatementBefund => ({
  art: "ohne-kostenart",
  blockierend: true,
  titel: "Ausgaben ohne Kostenart",
  text: "Ausgaben ohne Kostenart: 1.240,00 € …",
  ...over,
});

const bauen = (over: Parameters<typeof bauePruefliste>[0] | Partial<Parameters<typeof bauePruefliste>[0]> = {}) =>
  bauePruefliste({ befunde: [], abstimmung: [konto()], hatPositionen: true, ...over });

describe("Fortschritt", () => {
  it("zählt offene gegen alle Punkte", () => {
    // Vorher stand nirgends, wie viel noch zu tun ist: Fehler in einem Kasten,
    // Hinweise in einem zweiten, die Konten in einer Tabelle darunter.
    const liste = bauen({ befunde: [befund()] });
    expect(liste.gesamt).toBe(3); // Konto + Befund + bestandene Verteilung
    expect(liste.offen).toBe(1);
    expect(liste.fortschritt).toBe("1 von 3 Punkten offen");
  });

  it("meldet die leere Liste als erledigt, nicht als „0 von 0\"", () => {
    const liste = bauen();
    expect(liste.offen).toBe(0);
    expect(liste.fortschritt).toBe("Alle 2 Punkte erledigt.");
  });
});

describe("Gliederung nach blockierend / zu klären / erledigt", () => {
  it("trennt Fehler von Hinweisen und Erledigtem", () => {
    const liste = bauen({
      befunde: [befund(), befund({ art: "zufuehrung-plan", blockierend: false, titel: "Plan" })],
    });
    const nach = (status: string) => liste.punkte.filter((p) => p.status === status).map((p) => p.titel);
    expect(nach("blockierend")).toEqual(["Ausgaben ohne Kostenart"]);
    expect(nach("zuklaeren")).toEqual(["Plan"]);
    expect(nach("erledigt")).toEqual(['Konto „Girokonto"', "Verteilung auf die Einheiten"]);
  });

  it("führt ein Konto mit Verdacht als „zu klären\", obwohl der Stand stimmt", () => {
    // Eine Zuführung, die als Einnahme gebucht wurde, lässt den Kontostand
    // stimmen — und die Erhaltungsrücklage in der Abrechnung trotzdem falsch
    // aussehen. Als „erledigt" abzuhaken wäre genau der Fehler, um den es geht.
    const liste = bauen({
      abstimmung: [
        konto({
          verdachte: [
            { art: "zufuehrung-falsche-art", text: "… ist als Einnahme gebucht …" },
          ],
        }),
      ],
    });
    const punkt = liste.punkte.find((p) => p.id === "konto-giro")!;
    expect(punkt.status).toBe("zuklaeren");
    expect(punkt.verdachte).toHaveLength(1);
  });

  it("zählt die bestandene Verteilung als Punkt — aber nicht bei leerer Abrechnung", () => {
    // Bei einer leeren Abrechnung ist die Prüfung 0 = 0 und bestätigt nichts.
    expect(bauen().punkte.map((p) => p.id)).toContain("verteilung-ok");
    expect(bauen({ hatPositionen: false }).punkte.map((p) => p.id)).not.toContain("verteilung-ok");
  });
});

describe("Die Frage des Verwalters: Programm oder Bestand?", () => {
  it("nennt eine Abweichung als das, was sie ist — nicht als Programmfehler", () => {
    const liste = bauen({
      abstimmung: [
        konto({
          stimmt: false,
          diffCents: 124_000,
          reportedEndCents: 1_124_000,
          satz: "Der Kontoauszug weist 1.240,00 € mehr aus als die Buchungen ergeben.",
        }),
      ],
    });
    expect(liste.ursache).toBe("abweichung");
    expect(liste.antwort).toContain("Das Programm vermisst nichts");
    expect(liste.handgriff).toContain('Konto „Girokonto"');
  });

  it("sagt bei fehlendem Endbestand, dass eine Eingabe erwartet wird", () => {
    const liste = bauen({
      abstimmung: [
        konto({ stimmt: false, diffCents: null, reportedEndCents: null, satz: "… noch nicht eingetragen." }),
      ],
    });
    expect(liste.ursache).toBe("eingabe");
    expect(liste.antwort).toContain("fehlt eine Eingabe");
    expect(liste.handgriff).toContain("Endbestand laut Kontoauszug eintragen");
  });

  it("gibt der Abweichung Vorrang vor einer fehlenden Eingabe", () => {
    // Beides blockiert. Nur eines von beidem beantwortet die Frage, warum die
    // Abrechnung nicht fertig wird — und das ist die harte Aussage.
    const liste = bauen({
      abstimmung: [
        konto({ accountId: "a", stimmt: false, diffCents: null, reportedEndCents: null, satz: "…" }),
        konto({ accountId: "b", stimmt: false, diffCents: -500, reportedEndCents: 999_500, satz: "…" }),
      ],
    });
    expect(liste.ursache).toBe("abweichung");
  });

  it("unterscheidet fehlende Stammdaten von fehlender Zuordnung", () => {
    expect(
      bauen({ befunde: [befund({ art: "stammdaten", titel: "Aufzug" })] }).antwort,
    ).toContain("Stammdaten");
    expect(bauen({ befunde: [befund()] }).antwort).toContain("Kostenart");
  });

  it("sagt bei reinen Hinweisen, dass nichts aufgehalten wird", () => {
    const liste = bauen({
      befunde: [befund({ art: "zufuehrung-plan", blockierend: false, titel: "Plan" })],
    });
    expect(liste.ursache).toBe("hinweis");
    expect(liste.antwort).toContain("Nichts hält die Abrechnung auf");
  });

  it("bestätigt die fertige Abrechnung und nennt den nächsten Schritt", () => {
    const liste = bauen();
    expect(liste.ursache).toBe("fertig");
    expect(liste.antwort).toContain("lässt sich fertigstellen");
    expect(liste.handgriff).toContain("fertigstellen");
  });
});

describe("Ohne Konto", () => {
  it("blockiert und sagt warum, statt stillschweigend fertig zu wirken", () => {
    // Die Sperre in `finalizeStatement` greift auch ohne Konto. Eine Prüfliste,
    // die dann „alles erledigt" meldet, erklärt einen gesperrten Knopf nicht.
    const liste = bauePruefliste({ befunde: [], abstimmung: [], hatPositionen: true });
    expect(liste.punkte.find((p) => p.id === "konten-fehlen")?.status).toBe("blockierend");
    expect(liste.offen).toBe(1);
    expect(liste.ursache).toBe("stammdaten");
  });
});
