import { describe, expect, it } from "vitest";
import {
  pruefeAblage,
  warnungAblageKonfiguration,
  type AblageSonden,
  type PruefSchluessel,
  type PruefStatus,
} from "./ablage-check";

// Diese Prüfung ist ein Diagnosewerkzeug: Ihr einziger Wert liegt darin, dass
// sie die RICHTIGE Ursache nennt. Sagt sie „Store ist öffentlich", wo das Token
// fehlt, ist sie schlimmer als keine Prüfung — dann wird stundenlang am
// falschen Ende gesucht, mit einem grünen Häkchen als Rückendeckung.
//
// Deshalb steht hier jeder Ausgang einzeln: die beiden Produktionsfälle, die
// diesen Auftrag ausgelöst haben (kein Token / öffentlicher Store), und die
// Wege, auf denen ein übersprungener Punkt fälschlich als „in Ordnung"
// durchgehen könnte.

const TOKEN_URL = "https://abc.public.blob.vercel-storage.com/selbsttest/x.txt";

/** Voll funktionsfähige Ablage — die Grundlage, aus der jeder Fall abweicht. */
function heileSonden(ueberschreiben: Partial<AblageSonden> = {}): AblageSonden {
  let abgelegt: Buffer = Buffer.alloc(0);
  return {
    tokenGesetzt: () => true,
    umgebung: () => "production",
    schreibe: async (inhalt) => {
      abgelegt = inhalt;
      return TOKEN_URL;
    },
    lies: async () => abgelegt,
    oeffentlichAbrufbar: async () => false,
    loesche: async () => {},
    ...ueberschreiben,
  };
}

function punkt(ergebnis: { punkte: { schluessel: PruefSchluessel; status: PruefStatus }[] }, s: PruefSchluessel) {
  const p = ergebnis.punkte.find((x) => x.schluessel === s);
  if (!p) throw new Error(`Punkt ${s} fehlt im Ergebnis`);
  return p;
}

describe("pruefeAblage", () => {
  it("meldet eine eingerichtete Ablage vollständig als in Ordnung", async () => {
    const ergebnis = await pruefeAblage(heileSonden());
    expect(ergebnis.gesamt).toBe("ok");
    expect(ergebnis.punkte.map((p) => p.status)).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("legt die Testdatei privat ab und liest denselben Inhalt zurück", async () => {
    // Schreiben allein genügt nicht: Ein Upload, der ankommt und sich nicht
    // wieder abrufen lässt, ist für den Eigentümer dasselbe wie kein Upload.
    const ergebnis = await pruefeAblage(
      heileSonden({ lies: async () => Buffer.from("etwas ganz anderes") }),
    );
    expect(punkt(ergebnis, "lesen").status).toBe("fehler");
    expect(ergebnis.gesamt).toBe("fehler");
  });

  it("räumt die Testdatei wieder weg", async () => {
    const geloescht: string[] = [];
    await pruefeAblage(
      heileSonden({
        loesche: async (url) => {
          geloescht.push(url);
        },
      }),
    );
    expect(geloescht).toEqual([TOKEN_URL]);
  });

  it("stolpert nicht, wenn das Aufräumen fehlschlägt", async () => {
    // Eine liegengebliebene Textdatei ist kein Befund, den ein Betreiber sehen
    // müsste — und schon gar kein Grund, die Diagnose als Fehler zu melden.
    const ergebnis = await pruefeAblage(
      heileSonden({
        loesche: async () => {
          throw new Error("Blob bereits weg");
        },
      }),
    );
    expect(ergebnis.gesamt).toBe("ok");
  });

  // ── Produktionsfall 1: kein Token ─────────────────────────────────────────
  describe("ohne Token", () => {
    it("ist in Produktion ein Fehler — dort schlägt jeder Upload fehl", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ tokenGesetzt: () => false }));
      expect(punkt(ergebnis, "token").status).toBe("fehler");
      expect(ergebnis.gesamt).toBe("fehler");
    });

    it("ist außerhalb der Produktion nur eine Warnung (Data-URL-Fallback)", async () => {
      const ergebnis = await pruefeAblage(
        heileSonden({ tokenGesetzt: () => false, umgebung: () => "preview" }),
      );
      expect(punkt(ergebnis, "token").status).toBe("warnung");
    });

    it("weist die übrigen Punkte als NICHT GEPRÜFT aus, nicht als in Ordnung", async () => {
      // Der gefährlichere Fehler wäre ein grünes Häkchen für etwas, das
      // niemand gemessen hat: Man liest „Store ist privat: in Ordnung" und
      // schließt daraus, dass es an etwas anderem liegt.
      const ergebnis = await pruefeAblage(heileSonden({ tokenGesetzt: () => false }));
      for (const s of ["schreiben", "lesen", "privat"] as const) {
        expect(punkt(ergebnis, s).status).toBe("warnung");
        expect(ergebnis.punkte.find((p) => p.schluessel === s)!.befund).toMatch(/Nicht geprüft/);
      }
    });

    it("berührt den Blob-Store gar nicht erst", async () => {
      let versuche = 0;
      await pruefeAblage(
        heileSonden({
          tokenGesetzt: () => false,
          schreibe: async () => {
            versuche += 1;
            return TOKEN_URL;
          },
        }),
      );
      expect(versuche).toBe(0);
    });

    it("nennt den Behebungsschritt, ohne das Token selbst zu zeigen", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ tokenGesetzt: () => false }));
      const p = ergebnis.punkte.find((x) => x.schluessel === "token")!;
      expect(p.behebung).toMatch(/Private/);
      expect(p.befund).toMatch(/nicht gesetzt/);
    });
  });

  // ── Produktionsfall 2: öffentlicher Store ─────────────────────────────────
  describe("öffentlicher Store", () => {
    it("erkennt ihn daran, dass `access: private` abgewiesen wird", async () => {
      // So äußert er sich zuerst: Das Token ist gesetzt, alles sieht
      // eingerichtet aus — und trotzdem geht kein einziger Upload durch.
      const ergebnis = await pruefeAblage(
        heileSonden({
          schreibe: async () => {
            throw new Error(
              "Datei konnte nicht gespeichert werden. Der Vercel-Blob-Store muss als " +
                "PRIVAT angelegt sein. Details: access denied",
            );
          },
        }),
      );
      expect(punkt(ergebnis, "schreiben").status).toBe("fehler");
      expect(
        ergebnis.punkte.find((p) => p.schluessel === "schreiben")!.behebung,
      ).toMatch(/Private/);
      // Ohne abgelegte Datei ist alles Weitere ungemessen.
      expect(punkt(ergebnis, "lesen").status).toBe("warnung");
      expect(punkt(ergebnis, "privat").status).toBe("warnung");
    });

    it("erkennt ihn auch, wenn das Schreiben durchgeht und die Datei offen liegt", async () => {
      // Der schlimmere der beiden Ausgänge: Uploads funktionieren, niemandem
      // fällt etwas auf — und jede Kundendatei ist für jeden abrufbar, der
      // ihre URL kennt. Die stehen in der Datenbank und in geteilten Links.
      const ergebnis = await pruefeAblage(heileSonden({ oeffentlichAbrufbar: async () => true }));
      expect(punkt(ergebnis, "privat").status).toBe("fehler");
      expect(ergebnis.gesamt).toBe("fehler");
    });

    it("wertet einen scheiternden Abruf ohne Zugangsdaten als privat", async () => {
      // Genau das soll passieren: Wer kein Token hat, kommt nicht heran. Ein
      // geworfener Fehler ist hier die Regel, nicht der Befund.
      const ergebnis = await pruefeAblage(
        heileSonden({
          oeffentlichAbrufbar: async () => {
            throw new Error("403 Forbidden");
          },
        }),
      );
      expect(punkt(ergebnis, "privat").status).toBe("ok");
    });
  });

  it("rät bei einer Netzstörung zum erneuten Versuch statt zur Neuanlage", async () => {
    // Ein Behebungsschritt, der bei jeder Störung „legen Sie einen neuen Store
    // an" sagt, führt irgendwann dazu, dass ein funktionierender Store ersetzt
    // wird — und mit ihm die Verbindung zu allen bereits abgelegten Dateien.
    const ergebnis = await pruefeAblage(
      heileSonden({
        schreibe: async () => {
          throw new Error("fetch failed");
        },
      }),
    );
    expect(ergebnis.punkte.find((p) => p.schluessel === "schreiben")!.behebung).toMatch(
      /wiederholen/i,
    );
  });
});

describe("warnungAblageKonfiguration", () => {
  it("warnt in Produktion ohne Token", () => {
    const warnung = warnungAblageKonfiguration({ VERCEL_ENV: "production" });
    expect(warnung).toMatch(/BLOB_READ_WRITE_TOKEN/);
    expect(warnung).toMatch(/Private/);
  });

  it("schweigt, wenn das Token gesetzt ist", () => {
    expect(
      warnungAblageKonfiguration({
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_geheim",
      }),
    ).toBeNull();
  });

  it("schweigt außerhalb der Produktion", () => {
    // Preview und lokale Entwicklung dürfen ohne Blob laufen — dort greift der
    // Data-URL-Fallback. Eine Warnung bei jedem `next dev` würde nach einer
    // Woche überlesen, und dann auch die echte in Produktion.
    expect(warnungAblageKonfiguration({ VERCEL_ENV: "preview" })).toBeNull();
    expect(warnungAblageKonfiguration({})).toBeNull();
  });

  it("gibt den Wert des Tokens nirgends preis", () => {
    // Die Warnung landet im Vercel-Log; Logs werden geteilt und weitergeleitet.
    const warnung = warnungAblageKonfiguration({ VERCEL_ENV: "production" });
    expect(warnung).not.toMatch(/vercel_blob_rw/);
  });
});
