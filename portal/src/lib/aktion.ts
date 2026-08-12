// ── Willkommensaktion: die ersten Monate gratis ───────────────────────────────
//
// EINE Quelle für alles, was die Aktion ausmacht: Code, Zeitraum, Platzzahl und
// die Länge der verlängerten Testphase. Banner, Preisseite, Registrierungsseite
// und die Gewährung selbst lesen von hier. Eine zweite Stelle, an der „3 Monate"
// oder das Enddatum im Text steht, läuft beim ersten Verlängern der Aktion
// auseinander — und dann bewirbt die Startseite etwas anderes, als die
// Registrierung gewährt.
//
// Die Aktion hat DREI Grenzen; sie müssen alle zusammen erfüllt sein:
//   1. Zeitraum — bis einschließlich `aktionsEnde()` (Env `AKTION_ENDE`).
//   2. Plätze   — die ersten `aktionsPlaetze()` Gemeinschaften (Env `AKTION_PLAETZE`).
//   3. Code     — `AKTIONS_CODE`, aus dem Werbelink oder von Hand eingetippt.
// Fällt eine davon weg, ist die Aktion vorbei: `aktionsStand()` gibt `null`
// zurück, das Banner verschwindet damit auf ALLEN Seiten gleichzeitig, und die
// Registrierung gewährt wieder die reguläre Testphase.
//
// **Was „gratis" hier technisch heißt:** Die Aktion verlängert die Testphase auf
// `AKTION_TRIAL_TAGE`. In der laufenden Testphase liefert `aktiverPlan()`
// (`lib/billing.ts`) den Tarif `pro`, und `PLAN_FUNKTIONEN.pro` schließt den
// Ticket-Weg zum zertifizierten Verwalter ein — der Umfang ist also der von
// Verwalter-Plus. Genau so darf es beworben werden, und nicht mehr. Nach Ablauf
// gilt wieder der Start-Umfang; es werden keine Zahlungsdaten erhoben und nichts
// verlängert sich automatisch (deshalb „ohne Bindung").
//
// Warum keine Gutschein-Tabelle in der Datenbank: Das ist EIN Start-Anreiz mit
// EINEM öffentlichen Code, keine Gutschein-Verwaltung. Kundenindividuelle
// Rabatte gehören nach Stripe — der Checkout lässt Gutscheincodes bereits zu
// (`allow_promotion_codes` in `lib/billing-checkout.ts`).

/** Der öffentliche Aktionscode, so wie er auf der Seite steht. */
export const AKTIONS_CODE = "PORTAL24";

/**
 * Herkunft (`Organization.referralSource`) einer über die Aktion angelegten
 * Gemeinschaft. Diese Zeile ist zugleich der Zähler für die Platzgrenze — ein
 * eigenes Feld dafür wäre eine Migration für eine einmalige Aktion.
 */
export const AKTIONS_QUELLE = "portal24";

/** Gratis-Monate, wie sie im Text beworben werden. */
export const AKTION_GRATIS_MONATE = 3;

/**
 * Länge der Testphase mit Aktion, in Tagen. 30 Tage je Monat — dieselbe
 * Rechnung wie bei der HausMatch-Kooperation (`lib/platform.ts`), die für „drei
 * Monate gratis" 90 Tage setzt.
 */
export const AKTION_TRIAL_TAGE = AKTION_GRATIS_MONATE * 30;

/** Letzter Tag der Aktion (ISO-Datum), wenn `AKTION_ENDE` nichts anderes sagt. */
const ENDE_VORGABE = "2026-09-30";

/** Zahl der Plätze, wenn `AKTION_PLAETZE` nichts anderes sagt. */
const PLAETZE_VORGABE = 50;

/**
 * Eingetippten Code vergleichbar machen: Großschreibung, alles außer Buchstaben
 * und Ziffern entfernt. Damit gilt „portal24", „Portal24-" und „PORTAL 24"
 * gleich — der Code wird abgeschrieben und weitererzählt, und ein Bindestrich
 * zu viel darf die Aktion nicht kosten.
 */
export function normalisiereAktionsCode(eingabe: string | null | undefined): string {
  return (eingabe ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 40);
}

/** Ist das der Aktionscode? (Auch der Werbelink `?ref=portal24` zählt.) */
export function istAktionsCode(eingabe: string | null | undefined): boolean {
  return normalisiereAktionsCode(eingabe) === AKTIONS_CODE;
}

/**
 * Letzter Aktionstag als ISO-Datum. Ein unbrauchbarer Env-Wert fällt auf die
 * Vorgabe zurück, statt die Seite mit „Invalid Date" zu zeigen oder die Aktion
 * still abzuschalten.
 */
function endeIso(): string {
  const roh = (process.env.AKTION_ENDE ?? "").trim();
  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(roh) && !Number.isNaN(Date.parse(`${roh}T00:00:00Z`));
  return gueltig ? roh : ENDE_VORGABE;
}

/**
 * Ende der Aktion als Zeitpunkt — Ende des beworbenen Tages.
 *
 * Gerechnet wird mit dem Tagesende in UTC: Berlin liegt davor (UTC+1/+2), die
 * Aktion endet also nie früher, als auf der Seite steht.
 */
export function aktionsEnde(): Date {
  return new Date(Date.parse(`${endeIso()}T23:59:59.999Z`));
}

/**
 * Das Enddatum, wie es auf der Seite steht (TT.MM.JJJJ).
 *
 * Bewusst aus den Teilen des ISO-Datums gesetzt und nicht über `Intl` aus dem
 * Zeitpunkt formatiert: Jener liegt auf 23:59:59 UTC, und in Europe/Berlin
 * formatiert stünde dort der FOLGETAG. Genau ein Tag Abweichung zwischen
 * Werbung und Wirkung — deshalb trägt der Stand den fertigen Text und keinen
 * `Date`, den ein Aufrufer erneut formatieren könnte.
 */
export function aktionsEndeText(): string {
  const [jahr, monat, tag] = endeIso().split("-");
  return `${tag}.${monat}.${jahr}`;
}

/** Zahl der Aktionsplätze („für die ersten …"). */
export function aktionsPlaetze(): number {
  const roh = Number.parseInt((process.env.AKTION_PLAETZE ?? "").trim(), 10);
  return Number.isInteger(roh) && roh > 0 ? roh : PLAETZE_VORGABE;
}

/** Der Stand der laufenden Aktion — alles, was ein Banner anzeigen muss. */
export type AktionsStand = {
  code: string;
  gratisMonate: number;
  trialTage: number;
  /** Letzter Tag der Aktion, fertig formatiert (TT.MM.JJJJ). */
  endeText: string;
  /** Angebrochene Tage bis zum Ende, mindestens 1 („nur noch heute"). */
  tageBisEnde: number;
  plaetze: number;
  /**
   * Freie Plätze, nie negativ — **nicht für die Anzeige**.
   *
   * Die Seiten nennen die Grenze („nur 50 Plätze"), nie den Verbrauch
   * (Entscheidung des Auftraggebers vom 11.08.2026): Ein laufender Stand verrät
   * nach außen, wie viele sich angemeldet haben, und eine hohe Restzahl
   * arbeitet gegen die Knappheit, mit der geworben wird. Gebraucht wird der
   * Wert für die Sperre (0 freie Plätze ⇒ `aktionsStand()` liefert `null`) und
   * für die Prüfungen; `aktion.test.ts` hält fest, dass er nicht in den
   * Marken-Seiten auftaucht.
   */
  restplaetze: number;
};

/**
 * Läuft die Aktion — und wenn ja, mit welchem Stand?
 *
 * `null` heißt: vorbei (Zeitraum abgelaufen oder Plätze weg). Bewusst ein
 * Rückgabewert statt eines `boolean` mit Nebenwerten: Wer `null` bekommt, kann
 * gar nichts anzeigen, und es gibt keinen halb gefüllten Stand, aus dem
 * versehentlich „noch 0 Plätze" auf die Seite gerät.
 */
export function aktionsStand(genutzt: number, jetzt: Date = new Date()): AktionsStand | null {
  const ende = aktionsEnde();
  const plaetze = aktionsPlaetze();
  const restplaetze = Math.max(0, plaetze - Math.max(0, genutzt));
  if (jetzt.getTime() > ende.getTime()) return null;
  if (restplaetze === 0) return null;
  return {
    code: AKTIONS_CODE,
    gratisMonate: AKTION_GRATIS_MONATE,
    trialTage: AKTION_TRIAL_TAGE,
    endeText: aktionsEndeText(),
    tageBisEnde: Math.max(1, Math.ceil((ende.getTime() - jetzt.getTime()) / 86_400_000)),
    plaetze,
    restplaetze,
  };
}

/**
 * Link auf die Registrierung MIT Code. Jeder Weg, der aus der Werbung heraus
 * angeboten wird, nimmt den Code mit — sonst muss er abgeschrieben werden, und
 * genau daran scheitern Aktionen.
 */
export function aktionsLink(pfad = "/registrieren"): string {
  return `${pfad}?code=${AKTIONS_CODE}`;
}
