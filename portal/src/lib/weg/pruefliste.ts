// Die Prüfliste der Jahresabrechnung: was fehlt, was blockiert, was steht.
//
// **Was vorher stand.** Zwei unverbundene Kästen: ein gelber „Prüfliste — vor
// dem Fertigstellen zu klären" mit den Fehlern und ein blauer „Zur Kenntnis"
// mit den Hinweisen. Dazwischen, weiter unten, die Kontentabelle mit einem „✗"
// pro Konto. Drei Orte für eine Frage, und keiner sagte, wie viel noch offen
// ist oder womit man anfängt.
//
// **Was diese Datei tut.** Sie zieht die Befunde der Verteilung
// (`annual-statement.ts`) und die Kontenabstimmung (`kontenabstimmung.ts`) zu
// EINER Liste zusammen, sortiert sie nach blockierend / zu klären / erledigt
// und beantwortet den Satz, den der Verwalter tatsächlich braucht: vermisst das
// Programm eine Eingabe, oder gibt der Bestand etwas nicht her?
//
// Pure Funktionen — die Seite rendert nur.
import type { StatementBefund, Pruefziel } from "./annual-statement";
import type { KontoAbstimmung, Verdacht } from "./kontenabstimmung";

export type PruefpunktStatus = "blockierend" | "zuklaeren" | "erledigt";

export type Pruefpunkt = {
  /** Stabil über Renderings hinweg — React-Key und Testanker. */
  id: string;
  status: PruefpunktStatus;
  titel: string;
  /** Der ausformulierte Satz. */
  text: string;
  ziel?: Pruefziel;
  /** Was die Diagnose zu diesem Punkt gefunden hat (nur bei Konten belegt). */
  verdachte?: Verdacht[];
};

/**
 * Woran es gerade hängt — die Antwort auf „liegt es am Programm oder an mir?".
 *
 * Die Reihenfolge ist die Rangfolge: Steht eine Abweichung im Raum, ist sie die
 * Antwort, auch wenn daneben noch eine Eingabe fehlt.
 */
export type Ursache =
  /** Buchungen und Kontoauszug sagen Verschiedenes. */
  | "abweichung"
  /** Das Programm wartet auf eine Eingabe (Endbestand, Beträge je Einheit). */
  | "eingabe"
  /** Den Stammdaten fehlt eine Angabe (MEA, Wohnfläche). */
  | "stammdaten"
  /** Buchungen sind keiner Kostenart zugeordnet. */
  | "zuordnung"
  /** Nichts blockiert, aber es gibt etwas zu prüfen. */
  | "hinweis"
  /** Alles beisammen. */
  | "fertig";

export type Pruefliste = {
  punkte: Pruefpunkt[];
  offen: number;
  gesamt: number;
  /** „3 von 5 Punkten offen" bzw. „Alle 5 Punkte erledigt." */
  fortschritt: string;
  ursache: Ursache;
  /** Der Satz über der Liste: liegt es am Programm oder am Bestand? */
  antwort: string;
  /** Der nächste Handgriff, ein Satz. */
  handgriff: string;
};

export type PrueflisteEingabe = {
  befunde: StatementBefund[];
  abstimmung: KontoAbstimmung[];
  /** Gab es im Wirtschaftsjahr überhaupt etwas zu verteilen? */
  hatPositionen: boolean;
};

const RANG: Record<Ursache, number> = {
  abweichung: 0,
  eingabe: 1,
  stammdaten: 2,
  zuordnung: 3,
  hinweis: 4,
  fertig: 5,
};

/** Welche Ursache steckt hinter einem Befund der Verteilung? */
function ursacheVonBefund(b: StatementBefund): Ursache {
  if (!b.blockierend) return "hinweis";
  switch (b.art) {
    case "verteilung":
      return "eingabe";
    case "stammdaten":
      return "stammdaten";
    case "ohne-kostenart":
      return "zuordnung";
    default:
      return "hinweis";
  }
}

export function bauePruefliste(eingabe: PrueflisteEingabe): Pruefliste {
  const punkte: Pruefpunkt[] = [];
  const ursachen: Ursache[] = [];

  // Ohne Konto gibt es nichts abzustimmen — und die Sperre in
  // `finalizeStatement` greift trotzdem. Das stillschweigend als „nichts zu
  // tun" darzustellen, hieße einen gesperrten Knopf ohne Begründung zu zeigen.
  if (eingabe.abstimmung.length === 0) {
    punkte.push({
      id: "konten-fehlen",
      status: "blockierend",
      titel: "Kein Konto angelegt",
      text: "Für dieses Objekt ist kein aktives Konto erfasst. Ohne Konto gibt es keinen Kontoauszug, gegen den sich die Abrechnung abgleichen ließe.",
      ziel: { art: "stammdaten", anker: "konten", label: "Konto in den Stammdaten anlegen" },
    });
    ursachen.push("stammdaten");
  }

  // ── Konten zuerst ─────────────────────────────────────────────────────────
  // Sie sind die harte Sperre und zugleich die Stelle, an der die Diagnose
  // hängt. Wer die Liste von oben liest, liest sie in der Reihenfolge, in der
  // sie zu bearbeiten ist.
  for (const konto of eingabe.abstimmung) {
    const offeneVerdachte = konto.verdachte.length > 0;
    if (konto.stimmt) {
      punkte.push({
        id: `konto-${konto.accountId}`,
        // Ein stimmendes Konto mit einem Verdacht ist nicht erledigt: Eine
        // Zuführung, die als Einnahme gebucht wurde, lässt den Kontostand
        // stimmen und die Rücklage in der Abrechnung trotzdem falsch aussehen.
        status: offeneVerdachte ? "zuklaeren" : "erledigt",
        titel: `Konto „${konto.name}"`,
        text: offeneVerdachte
          ? `${konto.satz} An den Buchungen fällt trotzdem etwas auf.`
          : konto.satz,
        verdachte: konto.verdachte,
      });
      if (offeneVerdachte) ursachen.push("hinweis");
      continue;
    }
    punkte.push({
      id: `konto-${konto.accountId}`,
      status: "blockierend",
      titel: `Konto „${konto.name}"`,
      text: konto.satz,
      ziel: {
        art: "abschnitt",
        anker: "konten",
        label:
          konto.reportedEndCents === null
            ? "Endbestand laut Kontoauszug eintragen"
            : "Zur Kontenabstimmung",
      },
      verdachte: konto.verdachte,
    });
    ursachen.push(konto.reportedEndCents === null ? "eingabe" : "abweichung");
  }

  // ── Befunde der Verteilung ────────────────────────────────────────────────
  for (const [i, b] of eingabe.befunde.entries()) {
    punkte.push({
      id: `befund-${b.art}-${i}`,
      status: b.blockierend ? "blockierend" : "zuklaeren",
      titel: b.titel,
      text: b.text,
      ziel: b.ziel,
    });
    ursachen.push(ursacheVonBefund(b));
  }

  // ── Die bestandene Verteilung ist auch ein Punkt ──────────────────────────
  // Sonst besteht eine Liste nur aus Problemen, und „3 von 5 offen" hätte keine
  // 5. Bewusst nur, wenn es überhaupt etwas zu verteilen gab: Bei einer leeren
  // Abrechnung ist die Prüfung 0 = 0 und bestätigt nichts (siehe
  // `hatPositionen` in annual-statement.ts).
  const verteilungOffen = eingabe.befunde.some(
    (b) => b.blockierend && (b.art === "verteilung" || b.art === "stammdaten"),
  );
  if (!verteilungOffen && eingabe.hatPositionen) {
    punkte.push({
      id: "verteilung-ok",
      status: "erledigt",
      titel: "Verteilung auf die Einheiten",
      text: "Die Summe der Einzelabrechnungen entspricht auf den Cent der Gesamtabrechnung. Ob alle Kosten des Jahres gebucht sind, prüft das nicht.",
    });
  }

  const offen = punkte.filter((p) => p.status !== "erledigt").length;
  const gesamt = punkte.length;
  const ursache = ursachen.sort((a, b) => RANG[a] - RANG[b])[0] ?? "fertig";
  const ersterOffener =
    punkte.find((p) => p.status === "blockierend") ?? punkte.find((p) => p.status === "zuklaeren");

  return {
    punkte,
    offen,
    gesamt,
    fortschritt:
      offen === 0
        ? `Alle ${gesamt} ${gesamt === 1 ? "Punkt" : "Punkte"} erledigt.`
        : `${offen} von ${gesamt} ${gesamt === 1 ? "Punkt" : "Punkten"} offen`,
    ursache,
    antwort: ANTWORT[ursache],
    handgriff: baueHandgriff(ursache, ersterOffener),
  };
}

/**
 * Der Satz über der Liste.
 *
 * Er sagt ausdrücklich, auf welcher Seite das Problem liegt. Das ist die Frage,
 * die der Verwalter stellt („liegt der Fehler beim Programm oder bei mir?"),
 * und sie wurde bisher nirgends beantwortet — die Prüfliste zählte nur auf.
 */
const ANTWORT: Record<Ursache, string> = {
  abweichung:
    "Das Programm vermisst nichts — es rechnet, was gebucht ist. Buchungen und Kontoauszug sagen Verschiedenes, und solange das so ist, wäre die Abrechnung nachweislich unvollständig. Die Abweichung steht unten mit Betrag und Richtung; darunter, was sie erfahrungsgemäß verursacht.",
  eingabe:
    "Hier fehlt eine Eingabe, kein Beleg: Das Programm wartet auf eine Zahl, die nur Sie haben. Gebucht ist alles, was gebucht sein kann.",
  stammdaten:
    "Nicht die Buchhaltung stockt, sondern die Stammdaten: Für mindestens einen Umlageschlüssel fehlt eine Angabe zu einer Einheit. Ohne sie ließe sich nur raten, und geraten wird hier nicht.",
  zuordnung:
    "Das Geld ist gebucht, aber das Programm weiß nicht, wohin damit: Es fehlt die Kostenart. Ohne sie lässt sich der Betrag keinem Umlageschlüssel zuordnen und deshalb auf niemanden umlegen.",
  hinweis:
    "Nichts hält die Abrechnung auf. Es steht aber etwas darin, das richtig sein kann und geprüft gehört — sehen Sie es einmal an, bevor Sie einfrieren.",
  fertig:
    "Alles beisammen: Die Verteilung geht auf, und jedes Konto stimmt mit seinem Kontoauszug überein. Die Abrechnung lässt sich fertigstellen.",
};

function baueHandgriff(ursache: Ursache, punkt: Pruefpunkt | undefined): string {
  if (ursache === "fertig" || !punkt) {
    return "Nächster Schritt: Abrechnung fertigstellen und einfrieren.";
  }
  const wohin = punkt.ziel ? ` — ${punkt.ziel.label}.` : ".";
  return `Nächster Handgriff: ${punkt.titel}${wohin}`;
}
