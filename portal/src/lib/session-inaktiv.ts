// Inaktivitäts-Timeout der Anmeldung — die reine Rechenregel.
//
// Ohne Datenbank und ohne Next-Importe, weil sie an zwei Stellen läuft: im
// Proxy (Edge, vor jeder Seite) und in `getSession` (Server). Beide müssen
// dieselbe Antwort geben, sonst erneuert der Proxy eine Sitzung, die der
// Server schon für abgelaufen hält — oder umgekehrt.
//
// Die Sitzung trägt zwei Angaben im Token: `idle` (Minuten, 0 = aus — die
// Einstellung des Kontos zum Zeitpunkt der Anmeldung) und `lat` (last
// activity, Unix-Sekunden). Der Proxy schreibt `lat` bei jeder Seitenanfrage
// neu, sobald es älter als eine Minute ist; die Sieben-Tage-Obergrenze (`exp`)
// bleibt dabei stehen. Rückmeldung aus dem Produkttest 09/2026: ein Beirat, der
// am gemeinsam genutzten Rechner arbeitet, will nach einer Weile automatisch
// draußen sein.

/** Name des Sitzungs-Cookies und Zweck-Kennung des Tokens — hier, weil der
 *  Proxy sie ohne `session.ts` (das die Datenbank zieht) braucht. */
export const SESSION_COOKIE = "bw_session";
export const SESSION_TYP = "session";
export const SESSION_TAGE = 7;

/** Cookie-Attribute der Sitzung — an beiden Ausstellstellen dieselben. */
export function sessionCookieAttribute(maxAgeSekunden: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSekunden,
  };
}

/** Wählbare Stufen; 0 heißt „keine automatische Abmeldung" (nur die 7 Tage). */
export const IDLE_TIMEOUT_STUFEN = [0, 15, 30, 60] as const;
export type IdleTimeoutMinuten = (typeof IDLE_TIMEOUT_STUFEN)[number];

/** Ab diesem Abstand schreibt der Proxy `lat` neu — nicht bei jedem Klick. */
export const LAT_ERNEUERN_AB_SEKUNDEN = 60;

export function istIdleTimeoutStufe(wert: number): wert is IdleTimeoutMinuten {
  return (IDLE_TIMEOUT_STUFEN as readonly number[]).includes(wert);
}

/**
 * Ist die Sitzung wegen Inaktivität abgelaufen?
 *
 * Ohne `idle` (0 oder fehlend) nie. Ohne `lat` (Token aus der Zeit vor dem
 * Timeout) gilt die Sitzung als abgelaufen, sobald ein Timeout gesetzt ist —
 * eine Anmeldung, deren letzte Aktivität niemand kennt, darf nicht auf
 * Verdacht weiterlaufen.
 */
export function istInaktiv(
  lat: number | null | undefined,
  idleMinuten: number | null | undefined,
  nowMs: number,
): boolean {
  if (!idleMinuten || idleMinuten <= 0) return false;
  if (lat == null) return true;
  return nowMs - lat * 1000 > idleMinuten * 60_000;
}

/** Lohnt sich das Neuschreiben von `lat`? (Nicht bei jedem Klick ein neuer Cookie.) */
export function latVeraltet(lat: number | null | undefined, nowMs: number): boolean {
  if (lat == null) return true;
  return nowMs - lat * 1000 >= LAT_ERNEUERN_AB_SEKUNDEN * 1000;
}
