// Abstimmung der Konten gegen den Kontoauszug — und die Diagnose dazu.
//
// **Die Sperre bleibt.** Für jedes Konto muss der von Hand eingetragene
// Endbestand laut Kontoauszug auf den Cent dem gerechneten Endbestand
// entsprechen, sonst lässt sich die Jahresabrechnung nicht fertigstellen
// (`finalizeStatement`). Eine Abrechnung, deren Konten nicht mit dem
// Kontoauszug übereinstimmen, ist keine Abrechnung.
//
// **Was fehlte, war die Diagnose.** In der Kontentabelle stand ein „✗" und
// sonst nichts: keine Differenz, keine Richtung, keine Ursache, kein Weg zur
// betroffenen Buchung. Der Verwalter weiß danach nicht einmal, ob der Fehler
// beim Programm liegt oder bei ihm — und genau diese Frage stellt er.
//
// Dieses Modul rechnet deshalb die Abweichung aus, sagt sie in einem Satz und
// prüft die fünf üblichen Ursachen aktiv ab. Genannt wird nur, was zutreffen
// **könnte**: Eine Liste aller denkbaren Fehler wäre wieder nur eine Liste.
//
// Pure Funktionen — die Abfragen stehen in `kontendiagnose-service.ts`.
import type { CostCategory, LedgerAccountKind } from "@/generated/prisma/client";
import { formatCents } from "@/lib/money";
import type { Pruefziel } from "./annual-statement";

/**
 * Wie weit vor und nach dem Ende des Wirtschaftsjahres nach einer Buchung
 * gesucht wird, die die Abweichung erklärt. Zehn Tage decken den Fall ab, um
 * den es geht — die Dezemberrechnung, die im Januar gebucht wurde, und die
 * Januarzahlung, die noch aufs alte Jahr gelaufen ist.
 */
export const RANDTAGE = 10;

/** Eine Buchung, so weit die Diagnose sie braucht. */
export type DiagnoseBuchung = {
  id: string;
  accountId: string;
  /** ISO-Datum (YYYY-MM-DD) — JSON-fähig, vergleichbar und ohne Zeitzonenfalle. */
  datum: string;
  kind: "EINNAHME" | "AUSGABE" | "UMBUCHUNG";
  /** Nur bei UMBUCHUNG belegt: true = Geld verlässt dieses Konto. */
  transferOut: boolean | null;
  /** Immer positiv; die Richtung steckt in `kind`/`transferOut`. */
  amountCents: number;
  text: string;
  costTypeName: string | null;
  costTypeCategory: CostCategory | null;
};

export type KontoEingabe = {
  id: string;
  name: string;
  kind: LedgerAccountKind;
  /** `LedgerAccount.openingBalanceCents` — der Stand vor der ersten Buchung. */
  openingBalanceCents: number;
  /** Rechnerischer Endbestand aus der Abrechnung. */
  endCents: number;
  /** Endbestand laut Kontoauszug; `null` = noch nicht eingetragen. */
  reportedEndCents: number | null;
  /**
   * Abweichung desselben Kontos in der Abrechnung des Vorjahres, falls es eine
   * gibt. Eine über Jahre **konstante** Abweichung ist das Erkennungszeichen
   * eines fehlenden Anfangsbestands: Der Fehler wandert unverändert mit.
   */
  vorjahrDiffCents?: number | null;
};

export type VerdachtArt =
  | "anfangsbestand"
  | "zufuehrung-falsche-art"
  | "zinsen-fehlen"
  | "ausgabe-falsches-konto"
  | "buchung-am-jahresrand";

export type Verdacht = {
  art: VerdachtArt;
  text: string;
  ziel?: Pruefziel;
};

export type KontoAbstimmung = {
  accountId: string;
  name: string;
  kind: LedgerAccountKind;
  endCents: number;
  reportedEndCents: number | null;
  /** Kontoauszug − Buchungen. `null`, solange nichts eingetragen ist. */
  diffCents: number | null;
  /** Nur `true`, wenn ein Wert eingetragen ist UND er auf den Cent passt. */
  stimmt: boolean;
  /** Die Abweichung in einem Satz Klartext. */
  satz: string;
  verdachte: Verdacht[];
};

/** Vorzeichenrichtiger Betrag — dieselbe Regel wie `journal.vorzeichenBetrag`. */
function vorzeichen(b: DiagnoseBuchung): number {
  if (b.kind === "EINNAHME") return b.amountCents;
  if (b.kind === "AUSGABE") return -b.amountCents;
  return b.transferOut ? -b.amountCents : b.amountCents;
}

/** ISO-Datum als deutsches Tagesdatum. */
function tag(iso: string): string {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

/**
 * Die Abweichung in einem Satz.
 *
 * Bewusst mit Richtung und nicht nur mit Betrag: „1.240,00 €" lässt offen, ob
 * Geld fehlt oder zu viel gebucht ist — und danach sucht man in die falsche
 * Richtung.
 */
export function beschreibeAbweichung(diffCents: number | null): string {
  if (diffCents === null) {
    return "Endbestand laut Kontoauszug noch nicht eingetragen — ohne ihn lässt sich nicht prüfen, ob die Buchungen vollständig sind.";
  }
  if (diffCents === 0) return "Kontoauszug und Buchungen stimmen auf den Cent überein.";
  return diffCents > 0
    ? `Der Kontoauszug weist ${formatCents(diffCents)} mehr aus als die Buchungen ergeben.`
    : `Der Kontoauszug weist ${formatCents(-diffCents)} weniger aus als die Buchungen ergeben.`;
}

/**
 * Sieht der Text oder die Kostenart nach einer Zuführung zur Rücklage aus?
 *
 * Die Umlaut-Umschreibung ist kein Detail: Buchungstexte kommen zum großen Teil
 * aus dem Bankimport, und dort steht regelmäßig „ZUFUEHRUNG ERHALTUNGSRUECKLAGE"
 * — viele Institute liefern den Verwendungszweck ohne Umlaute.
 */
function siehtNachZufuehrungAus(b: DiagnoseBuchung): boolean {
  return (
    b.costTypeCategory === "RUECKLAGENZUFUEHRUNG" ||
    /zuf(?:ü|ue?)hrung|r(?:ü|ue?)cklage/i.test(b.text)
  );
}

/** Sieht die Buchung nach einer Zinsgutschrift aus? */
function siehtNachZinsenAus(b: DiagnoseBuchung): boolean {
  return b.kind === "EINNAHME" && (b.costTypeCategory === "ERTRAG" || /zins/i.test(b.text));
}

/** Kurzform einer Buchung für die Meldung: „Text" vom 03.01.2027 über 1.240,00 €. */
function nenne(b: DiagnoseBuchung): string {
  return `„${b.text}" vom ${tag(b.datum)} über ${formatCents(b.amountCents)}`;
}

/** Link auf genau diese eine Buchung in der Buchhaltung. */
function zurBuchung(b: DiagnoseBuchung): Pruefziel {
  return { art: "buchhaltung", filter: { buchung: b.id }, label: "Diese Buchung öffnen" };
}

export type KontenabstimmungEingabe = {
  /** Ende des Wirtschaftsjahres als ISO-Datum, **exklusiv**. */
  fyEnd: string;
  konten: KontoEingabe[];
  /**
   * Buchungen im Fenster [fyEnd − RANDTAGE, fyEnd + RANDTAGE] über alle Konten.
   *
   * Nur das Ende des Wirtschaftsjahres ist eine Grenze, an der sich ein
   * Datumsfehler auf den **Endbestand** auswirkt: Was vor dem Jahresbeginn
   * gebucht ist, steckt ohnehin im Anfangsbestand und verschiebt das Ergebnis
   * nicht. Deshalb wird nur um dieses eine Datum herum gesucht.
   */
  randBuchungen: DiagnoseBuchung[];
  /**
   * Buchungen des Wirtschaftsjahres, die für die Rücklage erheblich sind: alles
   * auf Rücklagenkonten sowie alles mit einer Kostenart der Kategorie
   * RUECKLAGENZUFUEHRUNG oder INSTANDHALTUNG.
   */
  ruecklagenBuchungen: DiagnoseBuchung[];
};

export function stimmeKontenAb(eingabe: KontenabstimmungEingabe): KontoAbstimmung[] {
  const diffs = new Map<string, number | null>(
    eingabe.konten.map((k) => [
      k.id,
      k.reportedEndCents === null ? null : k.reportedEndCents - k.endCents,
    ]),
  );

  return eingabe.konten.map((konto) => {
    const diff = diffs.get(konto.id) ?? null;
    return {
      accountId: konto.id,
      name: konto.name,
      kind: konto.kind,
      endCents: konto.endCents,
      reportedEndCents: konto.reportedEndCents,
      diffCents: diff,
      stimmt: diff === 0,
      satz: beschreibeAbweichung(diff),
      verdachte: diagnostiziere(konto, diff, diffs, eingabe),
    };
  });
}

function diagnostiziere(
  konto: KontoEingabe,
  diff: number | null,
  diffs: Map<string, number | null>,
  eingabe: KontenabstimmungEingabe,
): Verdacht[] {
  const verdachte: Verdacht[] = [];
  const eigene = (b: DiagnoseBuchung) => b.accountId === konto.id;
  const zumKonto: Pruefziel = {
    art: "buchhaltung",
    filter: { konto: konto.id },
    label: `Buchungen auf „${konto.name}" ansehen`,
  };

  // ── 1. Anfangsbestand nicht gesetzt ───────────────────────────────────────
  // Der stille Klassiker: Die Buchführung beginnt mitten im Bestand, aber das
  // Konto startet bei 0,00 €. Die Abweichung ist dann in jedem Jahr dieselbe.
  if (diff !== null && diff !== 0 && konto.openingBalanceCents === 0) {
    const vorjahr = konto.vorjahrDiffCents;
    verdachte.push({
      art: "anfangsbestand",
      text:
        vorjahr != null && vorjahr === diff
          ? `Für dieses Konto ist kein Anfangsbestand hinterlegt (0,00 €) — und die Abrechnung des Vorjahres wich um genau denselben Betrag ab (${formatCents(diff)}). Eine über Jahre unveränderte Abweichung ist das Muster eines fehlenden Anfangsbestands: Es fehlt nicht eine Buchung dieses Jahres, sondern der Kontostand zu Beginn der Buchführung.`
          : `Für dieses Konto ist kein Anfangsbestand hinterlegt (0,00 €). Wenn das Konto bei Beginn der Buchführung nicht leer war, fehlt genau dieser Betrag — und zwar in jedem Jahr gleich.`,
      ziel: {
        art: "stammdaten",
        anker: "konten",
        label: "Anfangsbestand in den Stammdaten eintragen",
      },
    });
  }

  // ── 2. Zuführung mit der falschen Buchungsart ─────────────────────────────
  // Als Zuführung (Ist) zählt ausschließlich eine UMBUCHUNG, die auf einem
  // Rücklagenkonto eingeht (siehe `reserveTransferCents` in
  // statement-service.ts). Eine Einnahme erhöht zwar den Kontostand — das Konto
  // stimmt dann sogar —, aber in der Abrechnung erscheint keine Zuführung. Das
  // ist der häufigste Grund für „die Erhaltungsrücklage ist falsch" bei
  // gleichzeitig stimmenden Konten.
  if (konto.kind === "RUECKLAGE") {
    for (const b of eingabe.ruecklagenBuchungen) {
      if (!eigene(b) || b.kind !== "EINNAHME" || !siehtNachZufuehrungAus(b)) continue;
      verdachte.push({
        art: "zufuehrung-falsche-art",
        text: `${nenne(b)} ist als Einnahme gebucht, sieht aber nach einer Zuführung aus. In der Abrechnung zählt als Zuführung nur eine Umbuchung vom laufenden Konto auf das Rücklagenkonto — diese Buchung erhöht den Kontostand, taucht in der Abrechnung aber nicht als Zuführung auf.`,
        ziel: zurBuchung(b),
      });
    }
  }
  if (konto.kind === "GIRO") {
    for (const b of eingabe.ruecklagenBuchungen) {
      if (!eigene(b) || b.kind !== "AUSGABE" || !siehtNachZufuehrungAus(b)) continue;
      verdachte.push({
        art: "zufuehrung-falsche-art",
        text: `${nenne(b)} ist als Ausgabe gebucht, sieht aber nach einer Zuführung zur Erhaltungsrücklage aus. Die Zuführung ist keine Ausgabe der Gemeinschaft — das Geld bleibt ihres, es wechselt nur das Konto. Als Umbuchung erfasst, erscheint sie in der Abrechnung als Zuführung; als Ausgabe gar nicht.`,
        ziel: zurBuchung(b),
      });
    }
  }

  // ── 3. Zinsen auf dem Rücklagenkonto nicht gebucht ────────────────────────
  // Nur bei einer Abweichung nach oben: Zinsen erhöhen den Kontostand, sie
  // können eine Abweichung nach unten nicht erklären.
  if (konto.kind === "RUECKLAGE" && diff !== null && diff > 0) {
    const hatZinsen = eingabe.ruecklagenBuchungen.some((b) => eigene(b) && siehtNachZinsenAus(b));
    if (!hatZinsen) {
      verdachte.push({
        art: "zinsen-fehlen",
        text: `Auf diesem Rücklagenkonto ist im Wirtschaftsjahr keine Zinsgutschrift gebucht. Weist der Kontoauszug Zinsen aus, fehlen sie hier — und genau darum liegt der Auszug über den Buchungen.`,
        ziel: zumKonto,
      });
    }
  }

  // ── 4. Ausgabe vom Rücklagenkonto aufs Girokonto gebucht ──────────────────
  // Erkennungszeichen: Zwei Konten weichen um denselben Betrag in
  // entgegengesetzte Richtung ab. Auf dem Konto, das die Zahlung wirklich
  // verlassen hat, fehlt sie (Auszug < Buchungen); auf dem anderen steht sie zu
  // viel (Auszug > Buchungen).
  if (diff !== null && diff !== 0) {
    for (const anderes of eingabe.konten) {
      if (anderes.id === konto.id || anderes.kind === konto.kind) continue;
      if (diffs.get(anderes.id) !== -diff) continue;
      // Auszug höher als die Buchungen → hier steht eine Ausgabe zu viel.
      // Auszug niedriger → von hier ist das Geld tatsächlich abgegangen.
      const zuViel = diff > 0 ? konto : anderes;
      const zuWenig = diff > 0 ? anderes : konto;
      const treffer = eingabe.ruecklagenBuchungen.filter(
        (b) =>
          b.accountId === zuViel.id &&
          b.kind === "AUSGABE" &&
          b.amountCents === Math.abs(diff) &&
          b.costTypeCategory === "INSTANDHALTUNG",
      );
      verdachte.push({
        art: "ausgabe-falsches-konto",
        text:
          `„${anderes.name}" weicht um genau denselben Betrag in die andere Richtung ab. Das ist das Muster einer Ausgabe, die von „${zuWenig.name}" bezahlt, aber auf „${zuViel.name}" gebucht wurde.` +
          (treffer.length > 0
            ? ` Passend dazu: ${treffer.map(nenne).join(", ")} — eine Erhaltungsmaßnahme über genau diesen Betrag.`
            : ""),
        ziel:
          treffer.length === 1
            ? zurBuchung(treffer[0])
            : {
                art: "buchhaltung",
                filter: { konto: zuViel.id },
                label: `Buchungen auf „${zuViel.name}" ansehen`,
              },
      });
    }
  }

  // ── 5. Buchung knapp außerhalb des Wirtschaftsjahres ──────────────────────
  // Der häufigste Einzeltreffer. Der Betrag erklärt die Differenz auf den Cent,
  // und das Datum liegt wenige Tage neben der Jahresgrenze.
  if (diff !== null && diff !== 0) {
    for (const b of eingabe.randBuchungen) {
      if (!eigene(b)) continue;
      const betrag = vorzeichen(b);
      const nachDemJahr = b.datum >= eingabe.fyEnd;
      if (nachDemJahr && betrag === diff) {
        verdachte.push({
          art: "buchung-am-jahresrand",
          text: `${nenne(b)} liegt ${tage(eingabe.fyEnd, b.datum)} nach dem Ende des Wirtschaftsjahres und erklärt die Abweichung auf den Cent. Gehört sie noch ins Abrechnungsjahr, ist das Buchungsdatum zu korrigieren.`,
          ziel: zurBuchung(b),
        });
      } else if (!nachDemJahr && betrag === -diff) {
        verdachte.push({
          art: "buchung-am-jahresrand",
          text: `${nenne(b)} liegt kurz vor dem Ende des Wirtschaftsjahres und erklärt die Abweichung auf den Cent. Gehört sie schon ins Folgejahr, ist das Buchungsdatum zu korrigieren.`,
          ziel: zurBuchung(b),
        });
      }
    }
  }

  return verdachte;
}

/** „3 Tage" / „1 Tag" zwischen zwei ISO-Daten (fyEnd ist exklusiv, daher +1). */
function tage(fyEnd: string, datum: string): string {
  const ms = Date.parse(`${datum}T00:00:00Z`) - Date.parse(`${fyEnd}T00:00:00Z`);
  const n = Math.round(ms / 86_400_000) + 1;
  return `${n} ${n === 1 ? "Tag" : "Tage"}`;
}
