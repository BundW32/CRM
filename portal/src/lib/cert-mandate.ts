// Ermächtigung des Eigentümers, Bescheinigungen in seinem Namen zu erstellen.
//
// Rechtlicher Hintergrund: Die Wohnungsgeberbestätigung nach § 19 BMG schuldet
// der Wohnungsgeber. § 19 Abs. 5 BMG erlaubt ausdrücklich, dass ein Beauftragter
// sie ausstellt – dann muss die Beauftragung aber belegbar sein. Ohne
// dokumentierte Ermächtigung darf im Namen des Eigentümers nichts entstehen.
//
// Die Ermächtigung hängt an der **Person**, nicht am Objekt: Ein Eigentümer
// erteilt sie einmal, sie gilt für alle seine Einheiten. Dass sie nur greift,
// wenn die Einheit tatsächlich vermietet ist, muss nirgends gepflegt werden –
// das ergibt sich zum Zeitpunkt der Erzeugung aus dem aktiven Mietverhältnis
// (ohne Mieter gibt es ohnehin nichts zu bescheinigen).

export type CertMandateFields = {
  certMandateGrantedAt: Date | null;
  certMandateRevokedAt: Date | null;
  certMandateSource?: string | null;
};

/**
 * Woher stammt die Ermächtigung?
 *
 * `SELBST` — der Eigentümer hat sie im Portal erteilt.
 * `SCHRIFTLICH` — unterschriebene Vollmacht auf Papier, von der Verwaltung
 *   vermerkt. Nötig für Eigentümer ohne Portalzugang; ohne diesen Weg bliebe
 *   für sie überhaupt keine Bescheinigung möglich.
 *
 * Rechtlich sind beide gleichwertig – § 19 Abs. 5 BMG schreibt keine Form vor.
 * Unterschieden werden sie trotzdem, weil nur der schriftliche Weg eine
 * Fundstelle braucht und weil der Eigentümer sehen soll, was in seinem Namen
 * vermerkt wurde.
 */
export const CERT_MANDATE_SOURCES = ["SELBST", "SCHRIFTLICH"] as const;
export type CertMandateSource = (typeof CERT_MANDATE_SOURCES)[number];

export const certMandateSourceLabels: Record<CertMandateSource, string> = {
  SELBST: "im Portal erteilt",
  SCHRIFTLICH: "schriftlich erteilt, von der Verwaltung vermerkt",
};

export function isCertMandateSource(wert: string | null | undefined): wert is CertMandateSource {
  return (CERT_MANDATE_SOURCES as readonly string[]).includes(wert ?? "");
}

/** Liegt eine gültige, nicht widerrufene Ermächtigung vor? */
export function hasCertMandate(user: CertMandateFields | null | undefined): boolean {
  if (!user?.certMandateGrantedAt) return false;
  // Widerruf zählt nur, wenn er NACH der Erteilung liegt: Wer nach einem
  // Widerruf erneut ermächtigt, soll nicht dauerhaft gesperrt bleiben.
  if (user.certMandateRevokedAt && user.certMandateRevokedAt > user.certMandateGrantedAt) {
    return false;
  }
  return true;
}

/** Zeitpunkt der wirksamen Erteilung – für Nachweis und Anzeige. */
export function certMandateGrantedOn(user: CertMandateFields | null | undefined): Date | null {
  return hasCertMandate(user) ? (user?.certMandateGrantedAt ?? null) : null;
}
