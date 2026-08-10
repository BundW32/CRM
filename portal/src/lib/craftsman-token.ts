// Handwerker-Magic-Link: Erzeugung und Gültigkeit (P1-13).
//
// Handwerker haben kein Portalkonto — ihr Link auf /auftraege/[token] IST der
// Zugang. Bis zum 10.08.2026 galt ein einmal erzeugtes Token unbegrenzt: Eine
// weitergeleitete E-Mail genügte, und Auftrags-, Termin- und Rechnungsdaten
// standen dauerhaft offen. Deshalb trägt das Token jetzt ein Ausstellungsdatum
// (`Craftsman.accessTokenIssuedAt`) und läuft ab.
//
// Die Frist ist bewusst großzügig: Der Link kommt mit jeder Beauftragung neu
// ins Postfach, und JEDE Beauftragung erneuert das Ausstellungsdatum — ein
// aktiv beauftragter Handwerker merkt vom Ablauf nichts. Erst ein Link, über
// den monatelang nichts beauftragt wurde, wird ungültig; die nächste
// Beauftragung erzeugt dann ein frisches Token.

import crypto from "crypto";

export const MAGIC_LINK_GUELTIG_TAGE = 90;

export function neuesCraftsmanToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export type CraftsmanTokenQuelle = {
  accessToken: string | null;
  accessTokenIssuedAt: Date | null;
};

/**
 * Ist der Magic-Link dieses Handwerkers gültig?
 *
 * Ohne Ausstellungsdatum gilt ein vorhandenes Token als UNGÜLTIG (fail
 * closed): Die Migration setzt das Datum für den Bestand, und jede Stelle,
 * die ein Token schreibt, setzt es mit. Fehlt es trotzdem, ist irgendwo am
 * Ablauf vorbeigeschrieben worden — dann soll der Link auffallen, nicht
 * unbegrenzt weiterleben.
 */
export function istCraftsmanTokenGueltig(
  craftsman: CraftsmanTokenQuelle,
  now: Date = new Date(),
): boolean {
  if (!craftsman.accessToken || !craftsman.accessTokenIssuedAt) return false;
  const ablauf =
    craftsman.accessTokenIssuedAt.getTime() + MAGIC_LINK_GUELTIG_TAGE * 86_400_000;
  return now.getTime() < ablauf;
}
