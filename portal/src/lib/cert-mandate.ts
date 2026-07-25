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
};

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
