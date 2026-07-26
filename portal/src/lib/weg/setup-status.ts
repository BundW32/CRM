// Einrichtungsstand einer selbstverwalteten WEG.
//
// Der Grund für diese Datei: Die Reihenfolge der Einrichtung ist fachlich
// zwingend – ohne Kostenarten kein Wirtschaftsplan, ohne beschlossenen Plan
// keine Sollstellungen, ohne Sollstellungen keine offenen Posten. Der Code
// erzwingt sie längst, aber er *sagte* sie nirgends. Eine Gemeinschaft, die zum
// ersten Mal selbst verwaltet, lernte die Reihenfolge, indem sie in
// Fehlermeldungen lief.
//
// Was im System prüfbar ist, wird deshalb aus den Daten abgeleitet und nirgends
// gespeichert: Ein abgeleiteter Zustand kann nicht veralten, ein gespeichertes
// Häkchen schon. Nur die Schritte, die außerhalb des Systems stattfinden
// (Unterlagen, Bankkonto, Verwalterbestellung), sind Vermerke in `WegSetupStep`.

import { db } from "@/lib/db";

export type SetupStepKey =
  | "objekt"
  | "einheiten"
  | "eigentuemer"
  | "unterlagen"
  | "konto"
  | "bestellung"
  | "konten"
  | "kostenarten"
  | "wirtschaftsplan";

export type SetupStep = {
  key: SetupStepKey;
  title: string;
  /** Warum dieser Schritt nötig ist – in der Sprache eines Eigentümers. */
  why: string;
  done: boolean;
  /** Wohin der Schritt führt (null, solange es kein Objekt gibt). */
  href: string | null;
  /** Von Hand abzuhaken (außerhalb des Systems) statt aus Daten abgeleitet. */
  manual: boolean;
  /** Zusatzhinweis, wenn etwas angelegt, aber noch nicht stimmig ist. */
  warnung?: string;
};

/** Schritte, die außerhalb des Systems stattfinden und abgehakt werden. */
export const MANUAL_SETUP_STEPS: SetupStepKey[] = ["unterlagen", "konto", "bestellung"];

export type SetupStatus = {
  steps: SetupStep[];
  erledigt: number;
  gesamt: number;
  fertig: boolean;
  /** Der erste offene Schritt – die eine Sache, die jetzt zu tun ist. */
  naechster: SetupStep | null;
  propertyId: string | null;
};

/**
 * Ermittelt den Einrichtungsstand des WEG-Objekts.
 *
 * `propertyId === null` heißt: Es gibt noch gar kein Objekt – dann steht nur
 * der erste Schritt offen und alle weiteren haben noch kein Ziel.
 */
export async function loadSetupStatus(propertyId: string | null): Promise<SetupStatus> {
  if (!propertyId) return baueStatus(null, leereBefunde());

  const [property, unitAgg, unitCount, ownedUnits, konten, kostenarten, plan, manuell] =
    await Promise.all([
      db.property.findUnique({
        where: { id: propertyId },
        select: { meaTotal: true },
      }),
      db.unit.aggregate({ where: { propertyId }, _sum: { mea: true } }),
      db.unit.count({ where: { propertyId } }),
      // Einheiten mit mindestens einem aktuellen Eigentümer (validTo offen).
      db.unit.count({
        where: { propertyId, unitOwnerships: { some: { validTo: null } } },
      }),
      db.ledgerAccount.findMany({
        where: { propertyId, active: true },
        select: { kind: true, openingBalanceDate: true },
      }),
      db.costType.count({ where: { propertyId, active: true } }),
      db.economicPlan.count({ where: { propertyId, status: "BESCHLOSSEN" } }),
      db.wegSetupStep.findMany({ where: { propertyId }, select: { key: true } }),
    ]);

  const meaSumme = unitAgg._sum.mea ?? 0;
  const meaNenner = property?.meaTotal ?? null;

  return baueStatus(propertyId, {
    unitCount,
    ownedUnits,
    meaSumme,
    meaNenner,
    hatGiro: konten.some((k) => k.kind === "GIRO"),
    hatRuecklage: konten.some((k) => k.kind === "RUECKLAGE"),
    // Ein Anfangsbestand ohne Stichtag ist wertlos – er sagt nicht, wann er galt.
    ohneStichtag: konten.filter((k) => !k.openingBalanceDate).length,
    kostenarten,
    planBeschlossen: plan > 0,
    manuellErledigt: new Set(manuell.map((m) => m.key)),
  });
}

type Befunde = {
  unitCount: number;
  ownedUnits: number;
  meaSumme: number;
  meaNenner: number | null;
  hatGiro: boolean;
  hatRuecklage: boolean;
  ohneStichtag: number;
  kostenarten: number;
  planBeschlossen: boolean;
  manuellErledigt: Set<string>;
};

function leereBefunde(): Befunde {
  return {
    unitCount: 0,
    ownedUnits: 0,
    meaSumme: 0,
    meaNenner: null,
    hatGiro: false,
    hatRuecklage: false,
    ohneStichtag: 0,
    kostenarten: 0,
    planBeschlossen: false,
    manuellErledigt: new Set(),
  };
}

function baueStatus(propertyId: string | null, b: Befunde): SetupStatus {
  const weg = propertyId ? `/verwaltung/weg/${propertyId}` : null;
  const stammdaten = weg ? `${weg}/stammdaten` : null;

  // MEA stimmt, wenn ein Nenner gesetzt ist und die Anteile ihn treffen. Ohne
  // Nenner ist der Schritt trotzdem erledigt – MEA ist optional, solange die
  // Gemeinschaft nach Einheiten oder Fläche umlegt.
  const meaStimmt = b.meaNenner === null || b.meaSumme === b.meaNenner;

  const steps: SetupStep[] = [
    {
      key: "objekt",
      title: "WEG-Objekt anlegen",
      why: "Adresse und Verwaltungsart „WEG“ – die Grundlage für alles Weitere.",
      done: propertyId !== null,
      href: "/verwaltung/objekte",
      manual: false,
    },
    {
      key: "einheiten",
      title: "Einheiten mit Miteigentumsanteilen erfassen",
      why:
        "Die Miteigentumsanteile stehen in der Teilungserklärung. Nach ihnen werden " +
        "später die Kosten verteilt – ableiten aus der Wohnfläche lassen sie sich nicht.",
      done: b.unitCount > 0 && meaStimmt,
      warnung:
        b.unitCount > 0 && !meaStimmt
          ? `Die Anteile ergeben ${b.meaSumme}, der Nenner ist ${b.meaNenner}. Solange das nicht aufgeht, verteilt die Abrechnung falsch.`
          : undefined,
      href: stammdaten,
      manual: false,
    },
    {
      key: "eigentuemer",
      title: "Eigentümer je Einheit zuordnen",
      why:
        "Wem gehört welche Einheit seit wann? Der Stichtag entscheidet, wer bei " +
        "einem Verkauf welchen Teil der Jahresabrechnung trägt.",
      done: b.unitCount > 0 && b.ownedUnits === b.unitCount,
      warnung:
        b.unitCount > 0 && b.ownedUnits < b.unitCount
          ? `${b.unitCount - b.ownedUnits} von ${b.unitCount} Einheiten haben noch keinen Eigentümer.`
          : undefined,
      href: stammdaten,
      manual: false,
    },
    {
      key: "unterlagen",
      title: "Unterlagen der bisherigen Verwaltung anfordern",
      why:
        "Teilungserklärung, Beschluss-Sammlung, Protokolle, laufende Verträge und " +
        "die letzte Jahresabrechnung. Ohne sie fehlen Ihnen die Anfangsbestände.",
      done: b.manuellErledigt.has("unterlagen"),
      href: null,
      manual: true,
    },
    {
      key: "konto",
      title: "Eigenes Konto der Gemeinschaft eröffnen",
      why:
        "Die Gemeinschaft ist seit 2020 selbst rechtsfähig – das Geld gehört ihr, " +
        "nicht einem Eigentümer. Ein privates Konto vermischt beides.",
      done: b.manuellErledigt.has("konto"),
      href: null,
      manual: true,
    },
    {
      key: "bestellung",
      title: "Verwaltung durch Beschluss bestellen",
      why:
        "Auch wer aus den eigenen Reihen verwaltet, wird dazu bestellt. Unter neun " +
        "Einheiten muss die Person dafür nicht zertifiziert sein (§ 19 Abs. 2 Nr. 6 WEG).",
      done: b.manuellErledigt.has("bestellung"),
      href: "/beschluesse",
      manual: true,
    },
    {
      key: "konten",
      title: "Konten mit Anfangsbestand eintragen",
      why:
        "Girokonto und getrennte Erhaltungsrücklage, jeweils mit dem Stand zu einem " +
        "Stichtag. Ab diesem Punkt rechnet die Buchhaltung mit.",
      done: b.hatGiro && b.hatRuecklage && b.ohneStichtag === 0,
      warnung:
        b.hatGiro && b.hatRuecklage && b.ohneStichtag > 0
          ? "Ein Anfangsbestand ohne Stichtag sagt nicht, wann er galt – bitte ergänzen."
          : b.hatGiro && !b.hatRuecklage
            ? "Die Erhaltungsrücklage fehlt noch. Sie muss vom laufenden Konto getrennt geführt werden."
            : undefined,
      href: stammdaten,
      manual: false,
    },
    {
      key: "kostenarten",
      title: "Kostenkatalog übernehmen",
      why:
        "Welche Kosten es gibt und nach welchem Schlüssel sie verteilt werden. " +
        "Der Standardkatalog lässt sich per Knopfdruck übernehmen und danach anpassen.",
      done: b.kostenarten > 0,
      href: stammdaten,
      manual: false,
    },
    {
      key: "wirtschaftsplan",
      title: "Ersten Wirtschaftsplan beschließen",
      why:
        "Der Plan legt das Hausgeld je Einheit fest (§ 28 Abs. 1 WEG). Erst der " +
        "Beschluss macht daraus Forderungen – vorher gibt es nichts einzuziehen.",
      done: b.planBeschlossen,
      href: weg ? `${weg}/wirtschaftsplan` : null,
      manual: false,
    },
  ];

  const erledigt = steps.filter((s) => s.done).length;
  return {
    steps,
    erledigt,
    gesamt: steps.length,
    fertig: erledigt === steps.length,
    naechster: steps.find((s) => !s.done) ?? null,
    propertyId,
  };
}
