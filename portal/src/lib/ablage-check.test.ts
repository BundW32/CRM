import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pruefeAblage,
  warnungAblageKonfiguration,
  type AblageSonden,
  type PruefSchluessel,
  type PruefStatus,
} from "./ablage-check";
import { ablageZugang } from "./storage";

// Diese Prüfung ist ein Diagnosewerkzeug: Ihr einziger Wert liegt darin, dass
// sie die RICHTIGE Ursache nennt. Sagt sie „Store ist öffentlich", wo der
// Zugang fehlt, ist sie schlimmer als keine Prüfung — dann wird stundenlang am
// falschen Ende gesucht, mit einem grünen Häkchen als Rückendeckung.
//
// Deshalb steht hier jeder Ausgang einzeln: die Fälle, die diesen Auftrag
// ausgelöst haben (kein Store verbunden / öffentlicher Store / per OIDC
// verbunden, aber vom Code nicht erkannt), und die Wege, auf denen ein
// übersprungener Punkt fälschlich als „in Ordnung" durchgehen könnte.

const TOKEN_URL = "https://abc.public.blob.vercel-storage.com/selbsttest/x.txt";

/** Voll funktionsfähige Ablage — die Grundlage, aus der jeder Fall abweicht. */
function heileSonden(ueberschreiben: Partial<AblageSonden> = {}): AblageSonden {
  let abgelegt: Buffer = Buffer.alloc(0);
  return {
    zugangsart: () => "oidc",
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
  describe("ohne verbundenen Store", () => {
    it("ist in Produktion ein Fehler — dort schlägt jeder Upload fehl", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "keiner" }));
      expect(punkt(ergebnis, "zugang").status).toBe("fehler");
      expect(ergebnis.gesamt).toBe("fehler");
    });

    it("ist außerhalb der Produktion nur eine Warnung (Data-URL-Fallback)", async () => {
      const ergebnis = await pruefeAblage(
        heileSonden({ zugangsart: () => "keiner", umgebung: () => "preview" }),
      );
      expect(punkt(ergebnis, "zugang").status).toBe("warnung");
    });

    it("weist die übrigen Punkte als NICHT GEPRÜFT aus, nicht als in Ordnung", async () => {
      // Der gefährlichere Fehler wäre ein grünes Häkchen für etwas, das
      // niemand gemessen hat: Man liest „Store ist privat: in Ordnung" und
      // schließt daraus, dass es an etwas anderem liegt.
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "keiner" }));
      for (const s of ["schreiben", "lesen", "privat"] as const) {
        expect(punkt(ergebnis, s).status).toBe("warnung");
        expect(ergebnis.punkte.find((p) => p.schluessel === s)!.befund).toMatch(/Nicht geprüft/);
      }
    });

    it("berührt den Blob-Store gar nicht erst", async () => {
      let versuche = 0;
      await pruefeAblage(
        heileSonden({
          zugangsart: () => "keiner",
          schreibe: async () => {
            versuche += 1;
            return TOKEN_URL;
          },
        }),
      );
      expect(versuche).toBe(0);
    });

    it("nennt den Behebungsschritt, ohne Zugangsdaten selbst zu zeigen", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "keiner" }));
      const p = ergebnis.punkte.find((x) => x.schluessel === "zugang")!;
      expect(p.behebung).toMatch(/Private/);
      expect(p.befund).toMatch(/kein Blob-Store mit diesem Projekt verbunden/);
      // Beide Wege müssen genannt sein — sonst sucht der Betreiber nach einer
      // Variablen, die seine Verbindung gar nicht setzt.
      expect(p.befund).toMatch(/BLOB_STORE_ID/);
      expect(p.befund).toMatch(/BLOB_READ_WRITE_TOKEN/);
    });
  });

  // ── Produktionsfall 2: verbunden, aber nicht erkannt ──────────────────────
  // Der Fall, der tatsächlich eintrat. Der Store war privat angelegt und mit
  // beiden Projekten verbunden — nur setzt „Connect Project" heute kein
  // statisches Token mehr, sondern BLOB_STORE_ID plus OIDC. Wer allein nach dem
  // Token fragt, hält diesen Store für nicht vorhanden und meldet „nicht
  // verfügbar", während daneben alles bereitsteht.
  describe("per OIDC verbundener Store", () => {
    it("gilt als vollwertiger Zugang", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "oidc" }));
      expect(punkt(ergebnis, "zugang").status).toBe("ok");
      expect(ergebnis.gesamt).toBe("ok");
    });

    it("nennt den Weg, damit niemand das statische Token sucht", async () => {
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "oidc" }));
      const befund = ergebnis.punkte.find((p) => p.schluessel === "zugang")!.befund;
      expect(befund).toMatch(/OIDC/);
      expect(befund).toMatch(/BLOB_STORE_ID/);
    });

    it("gilt auch das statische Token weiterhin als Zugang", async () => {
      // Ältere Projekte laufen noch darüber; ein Umbau, der sie ausschließt,
      // hätte den Fehler nur auf die andere Seite verschoben.
      const ergebnis = await pruefeAblage(heileSonden({ zugangsart: () => "token" }));
      expect(punkt(ergebnis, "zugang").status).toBe("ok");
      expect(ergebnis.gesamt).toBe("ok");
    });
  });

  // ── Produktionsfall 3: öffentlicher Store ─────────────────────────────────
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
  it("warnt in Produktion, wenn gar kein Zugang besteht", () => {
    const warnung = warnungAblageKonfiguration({ VERCEL_ENV: "production" });
    expect(warnung).toMatch(/BLOB_READ_WRITE_TOKEN/);
    expect(warnung).toMatch(/BLOB_STORE_ID/);
    expect(warnung).toMatch(/Private/);
  });

  it("schweigt, wenn das statische Token gesetzt ist", () => {
    expect(
      warnungAblageKonfiguration({
        VERCEL_ENV: "production",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_geheim",
      }),
    ).toBeNull();
  });

  it("schweigt auch bei einem per OIDC verbundenen Store", () => {
    // Ohne diese Zeile schlüge die Startprüfung bei JEDEM Start eines korrekt
    // eingerichteten Projekts Alarm — und ein Alarm, der ohne Anlass feuert,
    // wird nach einer Woche überlesen. Dann auch der echte.
    expect(
      warnungAblageKonfiguration({ VERCEL_ENV: "production", BLOB_STORE_ID: "store_abc123" }),
    ).toBeNull();
  });

  it("schweigt außerhalb der Produktion", () => {
    // Preview und lokale Entwicklung dürfen ohne Blob laufen — dort greift der
    // Data-URL-Fallback. Eine Warnung bei jedem `next dev` würde nach einer
    // Woche überlesen, und dann auch die echte in Produktion.
    expect(warnungAblageKonfiguration({ VERCEL_ENV: "preview" })).toBeNull();
    expect(warnungAblageKonfiguration({})).toBeNull();
  });

  it("gibt keine Zugangsdaten preis", () => {
    // Die Warnung landet im Vercel-Log; Logs werden geteilt und weitergeleitet.
    const warnung = warnungAblageKonfiguration({ VERCEL_ENV: "production" });
    expect(warnung).not.toMatch(/vercel_blob_rw/);
  });
});

// ── Woran „verbunden" erkannt wird ──────────────────────────────────────────
// Diese Auskunft entscheidet, ob `saveUpload` überhaupt zum Blob-Store greift.
// Sie hat in Produktion falsch geantwortet, und niemand konnte es sehen: Der
// Store war da, die Antwort lautete „nichts da". Deshalb steht sie jetzt an
// einer Stelle (storage.ts) und wird hier für jeden Fall festgehalten.
describe("ablageZugang", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("erkennt den OIDC-Weg in einer Vercel-Laufzeit", () => {
    // Der Fall, den das Portal nicht kannte: Store verbunden, aber ohne
    // statisches Token — so verbindet „Connect Project" heute.
    vi.stubEnv("BLOB_STORE_ID", "store_abc123");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "1");
    expect(ablageZugang()).toBe("oidc");
  });

  it("lässt das statische Token weiterhin gelten, auch ohne Vercel-Laufzeit", () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_geheim");
    vi.stubEnv("VERCEL", "");
    expect(ablageZugang()).toBe("token");
  });

  it("greift NICHT nach dem Produktions-Store, nur weil `vercel env pull` lief", () => {
    // `vercel env pull` schreibt BLOB_STORE_ID mit auf den Entwicklerrechner.
    // Zählte das als Zugang, verlöre `next dev` seinen Dateisystem-Fallback und
    // liefe in einen Fehler, sobald das mitgezogene OIDC-Token abgelaufen ist —
    // ein Ärgernis, das erst beim ersten Upload auffiele und wie ein Fehler des
    // Portals aussähe.
    vi.stubEnv("BLOB_STORE_ID", "store_abc123");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    expect(ablageZugang()).toBe("keiner");
  });

  it("erlaubt den OIDC-Weg lokal, wenn ein gültiges Token vorliegt", () => {
    // Wer sich eines zieht, will bewusst gegen den echten Store arbeiten.
    vi.stubEnv("BLOB_STORE_ID", "store_abc123");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "eyJhbGciOi...");
    expect(ablageZugang()).toBe("oidc");
  });

  it("meldet „keiner“, wenn nichts davon gesetzt ist", () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    expect(ablageZugang()).toBe("keiner");
  });
});
