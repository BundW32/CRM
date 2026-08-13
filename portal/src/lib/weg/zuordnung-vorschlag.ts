// Zuordnungsvorschläge für Bankumsätze: Welche Einheit hat gezahlt, und auf
// welche Kostenart gehört diese Ausgabe?
//
// Bisher lag die Einheiten-Erkennung als lokale Funktion auf der Hausgeld-Seite
// und griff erst lange nach dem Import. Ausgaben bekamen überhaupt keinen
// Vorschlag — sie blieben ohne Kostenart liegen und blockierten später die
// Jahresabrechnung („Ausgaben ohne Kostenart"). Hier steht die Regelkunde
// deshalb einmal, prüfbar und ohne Datenbank.
//
// **Es bleibt ein Vorschlag.** Gebucht wird nichts von selbst: Jede Zuordnung
// verschiebt echtes Geld oder verändert eine Abrechnung, und ein Verwendungs-
// zweck ist Fließtext. Der Verwalter bestätigt — das Programm sortiert nur vor.
// Der Gütegrad sagt ihm, wie genau er hinsehen muss.
import { schlageZuordnungVor, type OffenerPosten } from "./payment-allocation";

export type Guete = "sicher" | "wahrscheinlich" | "unsicher";

export const GUETE_LABEL: Record<Guete, string> = {
  sicher: "sicher",
  wahrscheinlich: "wahrscheinlich",
  unsicher: "unsicher",
};

/** Ein Umsatz, wie ihn der Bankimport oder eine Buchung liefert. */
export type Umsatz = {
  text: string;
  reference?: string | null;
  counterparty?: string | null;
  /** immer positiv — die Richtung steckt in `kind`. */
  amountCents: number;
  kind: "EINNAHME" | "AUSGABE" | "UMBUCHUNG";
  bookingDate: Date;
};

export type Einheit = { id: string; label: string };

/** Offene Forderung mit ihrem Abrechnungszeitraum (für die Periodenerkennung). */
export type OffenerPostenMitPeriode = OffenerPosten & {
  periodYear: number;
  periodMonth: number;
  /** Restbetrag dieser Forderung — für den Betragstreffer. */
  offenCents: number;
};

/** Eine frühere Ausgabe mit ihrer Kostenart — Grundlage des Kostenart-Vorschlags. */
export type HistorienEintrag = {
  counterparty: string | null;
  reference: string | null;
  text: string;
  costTypeId: string;
  costTypeName: string;
  bookingDate: Date;
};

export type ZuordnungsKontext = {
  units: Einheit[];
  /** normalisierte IBAN → Einheit (aus dem aktiven SEPA-Mandat) */
  ibanZuEinheit: Map<string, string>;
  /** eindeutiger Nachname des Eigentümers → Einheit */
  nachnameZuEinheit: Map<string, string>;
  /** offene Forderungen je Einheit */
  offenePosten: Map<string, OffenerPostenMitPeriode[]>;
  /** frühere Ausgaben mit Kostenart, neueste zuerst */
  ausgabenHistorie: HistorienEintrag[];
};

export type Vorschlag = {
  unitId?: string;
  unitLabel?: string;
  costTypeId?: string;
  costTypeName?: string;
  guete: Guete;
  /** Warum — wörtlich so, wie es dem Verwalter angezeigt wird. */
  gruende: string[];
};

export function leererKontext(): ZuordnungsKontext {
  return {
    units: [],
    ibanZuEinheit: new Map(),
    nachnameZuEinheit: new Map(),
    offenePosten: new Map(),
    ausgabenHistorie: [],
  };
}

/** Kleinschreibung, ein Leerzeichen, keine Satzzeichen — für den Textabgleich. */
export function normalisiere(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:/\\|()[\]{}"'*_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function heuhaufen(u: Umsatz): string {
  return normalisiere(`${u.text} ${u.reference ?? ""} ${u.counterparty ?? ""}`);
}

// ── Periode aus dem Verwendungszweck ─────────────────────────────────────────

const MONATSNAMEN: Record<string, number> = {
  januar: 1, jan: 1, februar: 2, feb: 2, maerz: 3, märz: 3, mrz: 3, mar: 3,
  april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11,
  dezember: 12, dez: 12,
};

export type Periode = { month: number; year: number | null };

/**
 * Liest den Abrechnungszeitraum aus einem Verwendungszweck: „Hausgeld 03/2026",
 * „HG März 26", „Wohngeld 3/26".
 *
 * Ein vollständiges Datum („02.01.2023") ist **keine** Periodenangabe — es
 * steht in vielen Zwecktexten und würde sonst jeden Monat falsch benennen.
 */
export function erkennePeriode(text: string): Periode | null {
  const roh = text.toLowerCase();

  // 03/2026, 3/26, 03-2026 — aber nicht der Monatsteil eines Datums.
  const numerisch = roh.match(/(?<![\d.])(\d{1,2})\s*[/\-]\s*(\d{4}|\d{2})(?![\d.])/);
  if (numerisch) {
    const month = Number(numerisch[1]);
    if (month >= 1 && month <= 12) return { month, year: jahr(numerisch[2]) };
  }

  // „März 2026", „Dezember 25", „Jan"
  const namen = Object.keys(MONATSNAMEN).sort((a, b) => b.length - a.length).join("|");
  const benannt = roh.match(new RegExp(`\\b(${namen})\\b\\.?\\s*(\\d{4}|\\d{2})?`));
  if (benannt) {
    return { month: MONATSNAMEN[benannt[1]], year: benannt[2] ? jahr(benannt[2]) : null };
  }
  return null;
}

function jahr(text: string): number {
  const n = Number(text);
  return n < 100 ? 2000 + n : n;
}

// ── Einheit ──────────────────────────────────────────────────────────────────

type Treffer = { punkte: number; grund: string };

// Die Gewichte sind die Rangfolge aus der bisherigen Zuordnungs-Hilfe, nur
// ausgeschrieben: Die IBAN allein trägt eine Entscheidung, ein Nachname allein
// nicht. Zwei schwache Hinweise zusammen sind mehr wert als einer davon —
// deshalb wird addiert und nicht die erste Regel genommen, die zutrifft.
const PUNKTE = {
  iban: 100,
  kurzzeichen: 60,
  nachname: 40,
  betrag: 30,
  periode: 20,
} as const;

function guetegrad(punkte: number): Guete | null {
  if (punkte >= 90) return "sicher";
  if (punkte >= 50) return "wahrscheinlich";
  if (punkte >= 20) return "unsicher";
  return null;
}

/**
 * Welche Einheit steckt hinter dieser Zahlung?
 *
 * Fünf Hinweise, die sich ergänzen: IBAN des SEPA-Mandats, Einheiten-Kurzzeichen
 * im Verwendungszweck, eindeutiger Nachname des Eigentümers, ein Betrag, der
 * die offenen Forderungen genau aufgehen lässt, und ein Zeitraum im Text, zu
 * dem eine offene Forderung passt.
 */
export function schlageEinheitVor(umsatz: Umsatz, kontext: ZuordnungsKontext): Vorschlag | null {
  if (umsatz.kind !== "EINNAHME") return null;
  const roh = `${umsatz.text} ${umsatz.reference ?? ""} ${umsatz.counterparty ?? ""}`;
  const stroh = heuhaufen(umsatz);
  const treffer = new Map<string, Treffer[]>();
  const merke = (unitId: string, t: Treffer) => {
    const liste = treffer.get(unitId) ?? [];
    liste.push(t);
    treffer.set(unitId, liste);
  };

  // 1) IBAN — im Umsatztext meist mit Leerzeichen, deshalb entfernen.
  const kompakt = roh.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [iban, unitId] of kontext.ibanZuEinheit) {
    if (iban.length >= 15 && kompakt.includes(iban)) {
      merke(unitId, { punkte: PUNKTE.iban, grund: "IBAN aus dem SEPA-Mandat" });
    }
  }

  // 2) Kurzform des Labels („WE 01, EG links" → „we 01")
  for (const u of kontext.units) {
    const kurz = normalisiere(u.label.split(",")[0]);
    if (kurz.length >= 3 && stroh.includes(kurz)) {
      merke(u.id, { punkte: PUNKTE.kurzzeichen, grund: `„${u.label.split(",")[0].trim()}" im Verwendungszweck` });
    }
  }

  // 3) Nachname, nur wenn im Objekt eindeutig — zwei Eigentümer namens Müller
  //    machen den Hinweis wertlos.
  for (const [nachname, unitId] of kontext.nachnameZuEinheit) {
    if (nachname.length >= 4 && stroh.includes(nachname)) {
      merke(unitId, { punkte: PUNKTE.nachname, grund: "Nachname des Eigentümers" });
    }
  }

  // 4) Betrag: Geht die Zahlung in den offenen Forderungen genau auf? Der
  //    Hinweis zählt nur, wenn er auf **eine** Einheit passt — bei gleichem
  //    Hausgeld für alle sagt er sonst gar nichts.
  const passend = [...kontext.offenePosten.entries()].filter(([, posten]) =>
    betragGehtAuf(umsatz.amountCents, posten, umsatz.bookingDate),
  );
  if (passend.length === 1) {
    merke(passend[0][0], { punkte: PUNKTE.betrag, grund: "Betrag deckt die offenen Sollstellungen genau" });
  }

  // 5) Zeitraum aus dem Verwendungszweck gegen eine offene Forderung.
  const periode = erkennePeriode(roh);
  if (periode) {
    for (const [unitId, posten] of kontext.offenePosten) {
      const passt = posten.some(
        (p) =>
          p.offenCents > 0 &&
          p.periodMonth === periode.month &&
          (periode.year === null || p.periodYear === periode.year),
      );
      if (passt) {
        merke(unitId, {
          punkte: PUNKTE.periode,
          grund: `offene Forderung für ${String(periode.month).padStart(2, "0")}/${periode.year ?? "?"}`,
        });
      }
    }
  }

  return bester(treffer, kontext.units);
}

function betragGehtAuf(betragCents: number, posten: OffenerPostenMitPeriode[], stichtag: Date): boolean {
  const offen = posten.filter((p) => p.offenCents > 0);
  if (offen.length === 0) return false;
  // Die Tilgungsreihenfolge (§§ 366, 367 BGB) ist gelöst — hier wird sie nur
  // befragt: Bleibt nach der Anrechnung nichts übrig, passt der Betrag genau.
  const vorschlag = schlageZuordnungVor(betragCents, offen, stichtag);
  return vorschlag.restCents === 0 && vorschlag.zuordnungen.length > 0;
}

function bester(treffer: Map<string, Treffer[]>, units: Einheit[]): Vorschlag | null {
  let besteId: string | null = null;
  let bestePunkte = 0;
  let besteGruende: string[] = [];
  let mehrdeutig = false;
  for (const [unitId, liste] of treffer) {
    const punkte = liste.reduce((s, t) => s + t.punkte, 0);
    if (punkte > bestePunkte) {
      besteId = unitId;
      bestePunkte = punkte;
      besteGruende = liste.map((t) => t.grund);
      mehrdeutig = false;
    } else if (punkte === bestePunkte) {
      mehrdeutig = true;
    }
  }
  // Gleichstand zwischen zwei Einheiten ist kein Vorschlag, sondern eine
  // Verwechslungsgefahr — dann lieber nichts vorschlagen.
  if (besteId === null || mehrdeutig) return null;
  const guete = guetegrad(bestePunkte);
  if (!guete) return null;
  return {
    unitId: besteId,
    unitLabel: units.find((u) => u.id === besteId)?.label,
    guete,
    gruende: besteGruende,
  };
}

// ── Kostenart ────────────────────────────────────────────────────────────────

/**
 * Welche Kostenart passt zu dieser Ausgabe?
 *
 * Aus der Historie: derselbe Zahlungspartner bekam zuletzt eine bestimmte
 * Kostenart — bei einer Hausverwaltung wiederholt sich das Jahr für Jahr
 * (Stadtwerke, Versicherung, Aufzugswartung). Findet sich kein Partner, zählt
 * die Ähnlichkeit des Verwendungszwecks.
 */
export function schlageKostenartVor(umsatz: Umsatz, historie: HistorienEintrag[]): Vorschlag | null {
  if (umsatz.kind !== "AUSGABE" || historie.length === 0) return null;

  const partner = normalisiere(umsatz.counterparty ?? "");
  if (partner.length >= 4) {
    const gleiche = historie.filter((h) => {
      const hp = normalisiere(h.counterparty ?? "");
      return hp.length >= 4 && (hp === partner || hp.includes(partner) || partner.includes(hp));
    });
    if (gleiche.length > 0) {
      const nachDatum = [...gleiche].sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime());
      const zuletzt = nachDatum[0];
      const einheitlich = gleiche.every((h) => h.costTypeId === zuletzt.costTypeId);
      const punkte = einheitlich ? (gleiche.length >= 3 ? 90 : 70) : 45;
      const guete = guetegrad(punkte);
      if (guete) {
        return {
          costTypeId: zuletzt.costTypeId,
          costTypeName: zuletzt.costTypeName,
          guete,
          gruende: [
            einheitlich
              ? `${gleiche.length}× derselbe Zahlungspartner, immer „${zuletzt.costTypeName}"`
              : `derselbe Zahlungspartner, zuletzt „${zuletzt.costTypeName}"`,
          ],
        };
      }
    }
  }

  // Ähnlicher Verwendungszweck — schwächer, deshalb nie „sicher".
  const worte = kernWorte(`${umsatz.text} ${umsatz.reference ?? ""}`);
  if (worte.size === 0) return null;
  let beste: { eintrag: HistorienEintrag; anteil: number } | null = null;
  for (const h of historie) {
    const andere = kernWorte(`${h.text} ${h.reference ?? ""}`);
    if (andere.size === 0) continue;
    let gemeinsam = 0;
    for (const w of worte) if (andere.has(w)) gemeinsam++;
    const anteil = gemeinsam / Math.min(worte.size, andere.size);
    if (!beste || anteil > beste.anteil) beste = { eintrag: h, anteil };
  }
  if (!beste || beste.anteil < 0.34) return null;
  return {
    costTypeId: beste.eintrag.costTypeId,
    costTypeName: beste.eintrag.costTypeName,
    guete: beste.anteil >= 0.6 ? "wahrscheinlich" : "unsicher",
    gruende: [`ähnlicher Verwendungszweck wie „${kuerze(beste.eintrag.text)}"`],
  };
}

function kernWorte(text: string): Set<string> {
  return new Set(
    normalisiere(text)
      .split(" ")
      // Zahlen und kurze Wörter tragen nichts: „RE2023613" ist bei jeder
      // Rechnung anders, „für" bei jeder gleich.
      .filter((w) => w.length >= 4 && !/\d/.test(w)),
  );
}

function kuerze(s: string): string {
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
}

/**
 * Der Vorschlag für einen Umsatz: Einnahmen bekommen eine Einheit, Ausgaben
 * eine Kostenart. Umbuchungen bekommen nichts — sie sind kein Aufwand und
 * gehören keiner Einheit.
 */
export function schlageVorschlagVor(umsatz: Umsatz, kontext: ZuordnungsKontext): Vorschlag | null {
  return umsatz.kind === "EINNAHME"
    ? schlageEinheitVor(umsatz, kontext)
    : schlageKostenartVor(umsatz, kontext.ausgabenHistorie);
}
