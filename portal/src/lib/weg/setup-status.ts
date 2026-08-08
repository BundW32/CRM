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
  | "kostenarten";

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
  /**
   * Der Schritt ist angestoßen, aber noch nicht abgeschlossen — etwa eine
   * laufende Abstimmung über die Verwalterbestellung.
   *
   * Bewusst getrennt von `done` und `warnung`: Dass der Schritt offen ist, ist
   * inhaltlich richtig, und ein Warnton wäre falsch. Es fehlte nur die
   * Rückmeldung. Ohne sie sieht eine Gemeinschaft, die gerade abstimmt, einen
   * unveränderten Punkt und fragt sich, ob das Portal ihre Abstimmung kennt.
   */
  zwischenstand?: { text: string; href: string };
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
  return ladeEinen(propertyId);
}

/**
 * Der Einrichtungsstand **jedes** Objekts, in der übergebenen Reihenfolge.
 *
 * Der Grund für diese Funktion: Bisher fragte die Übersicht `propIds[0]` ab —
 * das erste Objekt in beliebiger Datenbankreihenfolge. War davon eines fertig
 * eingerichtet, galt die Einrichtung als erledigt, und ein danach angelegtes
 * zweites Objekt bekam nie einen Assistenten. Genau so ist es beim Anlegen
 * einer Muster-WEG passiert: Die Führung existierte und war unerreichbar.
 *
 * Bewusst **nicht** für professionelle Verwaltungen gedacht: Jeder Aufruf
 * kostet sieben Abfragen, und bei achtzig Objekten liefe das in jeder
 * Seitenauslieferung. Dort steht der Assistent im Arbeitsbereich des Objekts,
 * das man gerade ansieht — dann ist es genau einer.
 */
export async function loadSetupStatusAlle(
  propertyIds: readonly string[],
): Promise<SetupStatus[]> {
  if (propertyIds.length === 0) return [];
  return Promise.all(propertyIds.map((id) => ladeEinen(id)));
}

async function ladeEinen(propertyId: string): Promise<SetupStatus> {

  const [
    property,
    unitAgg,
    unitCount,
    ownedUnits,
    konten,
    kostenarten,
    manuell,
    bestellungsBeschluss,
  ] = await Promise.all([
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
      db.wegSetupStep.findMany({ where: { propertyId }, select: { key: true } }),
      // Läuft gerade eine Abstimmung über die Verwalterbestellung?
      //
      // Erkannt wird sie am Titel — das Modell `Resolution` kennt kein Thema,
      // und eines einzuführen hieße, jeden Bestand nachzupflegen. Die Suche ist
      // deshalb bewusst großzügig und dient nur der Anzeige: Ein Treffer hakt
      // nichts ab, er zeigt einen Hinweis. Ein verpasster Treffer kostet diesen
      // Hinweis, ein falscher stiftet keinen Schaden.
      db.resolution.findFirst({
        where: {
          propertyId,
          status: "OFFEN",
          AND: [
            { title: { contains: "verwalt", mode: "insensitive" } },
            {
              OR: [
                { title: { contains: "bestell", mode: "insensitive" } },
                { title: { contains: "wahl", mode: "insensitive" } },
              ],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
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
    manuellErledigt: new Set(manuell.map((m) => m.key)),
    bestellungsBeschluss,
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
  manuellErledigt: Set<string>;
  /** Laufende Abstimmung über die Verwalterbestellung, falls es eine gibt. */
  bestellungsBeschluss?: { id: string; createdAt: Date } | null;
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
    manuellErledigt: new Set(),
  };
}

function baueStatus(propertyId: string | null, b: Befunde): SetupStatus {
  // Anker je Schritt: Die Stammdaten tragen fünf Abschnitte untereinander –
  // ohne Fragment landet man oben und sucht die Stelle, um die es geht.
  const stammdaten = (anker: string) =>
    propertyId ? `/verwaltung/weg/${propertyId}/stammdaten#${anker}` : null;

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
      href: stammdaten("einheiten"),
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
      // Solange noch niemand erfasst ist, führt dieser Schritt ins
      // Objektformular: Dort werden Personen **angelegt** und zugleich der
      // Einheit zugeordnet. Die Stammdaten können nur aus vorhandenen Personen
      // auswählen — eine frisch registrierte Gemeinschaft stand dort vor einem
      // leeren Auswahlfeld und kam bei Schritt 3 von 8 nicht weiter.
      // Sobald Eigentümer da sind, ist die Stammdatenseite das richtige Ziel:
      // Dort liegen Stichtag, Anteil und der Eigentümerwechsel.
      href:
        b.ownedUnits === 0 && propertyId
          ? `/verwaltung/objekte/${propertyId}/bearbeiten#einheiten`
          : stammdaten("eigentuemer"),
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
        // Die Ausnahme des § 19 Abs. 2 Nr. 6 WEG hat drei Bedingungen, nicht
        // eine: weniger als neun Sondereigentumsrechte, ein Eigentümer als
        // Verwalter — UND kein Drittel, das die Zertifizierung verlangt. Die
        // Kurzfassung „unter neun Einheiten braucht es keine Zertifizierung"
        // ließ den letzten Punkt weg und hätte eine Gemeinschaft in einen
        // angreifbaren Bestellungsbeschluss laufen lassen.
        "Auch wer aus den eigenen Reihen verwaltet, wird dazu bestellt. Zertifiziert " +
        "sein muss die Person nicht, solange die Anlage weniger als neun Einheiten hat, " +
        "ein Eigentümer das Amt übernimmt und kein Drittel der Eigentümer die " +
        "Zertifizierung verlangt (§ 19 Abs. 2 Nr. 6 WEG).",
      done: b.manuellErledigt.has("bestellung"),
      href: b.bestellungsBeschluss
        ? `/beschluesse/${b.bestellungsBeschluss.id}`
        : "/beschluesse",
      manual: true,
      // Läuft die Abstimmung schon, sagt der Schritt das — abgehakt wird er
      // trotzdem erst mit dem Ergebnis. Ohne diesen Hinweis sah der Punkt
      // unverändert aus, obwohl genau dafür bereits ein Umlaufbeschluss lief.
      zwischenstand:
        !b.manuellErledigt.has("bestellung") && b.bestellungsBeschluss
          ? {
              text: `Abstimmung läuft seit ${new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeZone: "Europe/Berlin",
              }).format(b.bestellungsBeschluss.createdAt)}`,
              href: `/beschluesse/${b.bestellungsBeschluss.id}`,
            }
          : undefined,
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
      href: stammdaten("konten"),
      manual: false,
    },
    {
      key: "kostenarten",
      title: "Kostenkatalog übernehmen",
      why:
        "Welche Kosten es gibt und nach welchem Schlüssel sie verteilt werden. " +
        "Der Standardkatalog lässt sich per Knopfdruck übernehmen und danach anpassen.",
      done: b.kostenarten > 0,
      href: stammdaten("kostenarten"),
      manual: false,
    },
    // Der Wirtschaftsplan stand hier einmal als neunter Schritt. Er gehört nicht
    // hierher: Die acht Schritte sind Stammdaten – einmal erfasst, dann fertig.
    // Der Wirtschaftsplan ist laufender Betrieb und wiederholt sich jedes Jahr.
    // Als Einrichtungsschritt hätte er die Einrichtung außerdem nie enden lassen,
    // solange eine Gemeinschaft ihn (etwa bei unterjähriger Übernahme) noch gar
    // nicht aufstellen kann. Er ist jetzt der erste Punkt des Jahresfahrplans.
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
