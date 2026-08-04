// Übergabe frisch erzeugter Erst-Passwörter an die Zugangsschreiben-Seite.
//
// **Warum nicht wie bisher über die Adresszeile.** Fünf Server-Actions leiteten
// mit `?pw=<Klartext>` weiter, die Sammel-Variante sogar mit
// `?u=id~pw~id~pw~…` für ein ganzes Objekt auf einmal. Eine URL ist der
// schlechteste denkbare Ort für ein Passwort: Sie steht im Zugriffsprotokoll
// jedes Servers und jedes Proxys davor, im Browserverlauf, in der Sitzung
// jedes Kollegen, dem man den Bildschirm teilt — und im `Referer` jeder
// Ressource, die die Seite nachlädt. Nichts davon ist gewollt, und keiner
// dieser Speicher lässt sich nachträglich aufräumen.
//
// **Warum kein Eintrag in der Datenbank.** Ein Passwort muss im Zugangsschreiben
// im Klartext stehen — genau einmal, zum Ausdrucken. Es zu speichern hieße,
// Klartext-Passwörter in die Datenbank zu legen, und sei es kurz; das ist
// dieselbe Klasse Fehler eine Ebene tiefer. Der Weg über ein
// Reset-Token wie in P1-6 (`token-hash.ts`) hilft hier nicht: Ein Hash lässt
// sich nicht wieder in ein druckbares Passwort verwandeln.
//
// **Deshalb ein kurzlebiges Cookie.** Es reist nicht in Protokollen, nicht im
// Verlauf und nicht im `Referer`, es ist auf den Pfad der Schreiben begrenzt,
// `httpOnly` (kein Zugriff aus Skripten) und läuft nach fünf Minuten von selbst
// ab. Danach greift die Ansage, die auf der Seite ohnehin schon steht: Das
// Erst-Passwort ist nur direkt nach der Erstellung zu sehen; sonst erzeugt man
// ein neues.
//
// Die Grenze ehrlich benannt: Solange das Cookie gilt, zeigt ein Neuladen das
// Schreiben erneut. Das ist Absicht — ein versehentlich geschlossener Reiter
// soll den Druck nicht kosten — und der Grund für die kurze Frist.

import { cookies } from "next/headers";

const COOKIE = "zugangsschreiben";
/** Nur an die Schreiben-Seiten senden, nicht an jede Anfrage des Portals. */
const PFAD = "/zugangsschreiben";
const GUELTIG_SEKUNDEN = 5 * 60;

export type Erstzugang = { id: string; pw: string };

/**
 * Merkt die Erst-Passwörter für die anschließende Weiterleitung.
 *
 * Nur aus einer Server-Action aufrufbar: Beim Rendern einer Server-Komponente
 * lassen sich keine Cookies setzen (die Antwort-Header sind dann schon
 * unterwegs). Das passt zum Ablauf — erzeugt werden die Passwörter ohnehin in
 * einer Aktion, angezeigt in einer Komponente.
 */
export async function merkeErstzugaenge(eintraege: readonly Erstzugang[]): Promise<void> {
  const gefiltert = eintraege.filter((e) => e.id && e.pw);
  if (gefiltert.length === 0) return;
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(Object.fromEntries(gefiltert.map((e) => [e.id, e.pw]))), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: PFAD,
    maxAge: GUELTIG_SEKUNDEN,
  });
}

/** Kurzform für den häufigen Fall genau einer Person. */
export async function merkeErstzugang(id: string, pw: string | null | undefined): Promise<void> {
  if (!pw) return;
  await merkeErstzugaenge([{ id, pw }]);
}

/**
 * Liest die gemerkten Erst-Passwörter — Nutzer-ID → Klartext.
 *
 * Gibt bei fehlendem, abgelaufenem oder beschädigtem Cookie eine leere Zuordnung
 * zurück. Die aufrufende Seite prüft die Zugriffsrechte auf die Nutzer selbst
 * weiter über `canVerwalterManageUser` bzw. die Organisations-Wand; dieses
 * Cookie ist ein Transportmittel, keine Berechtigung.
 */
export async function liesErstzugaenge(): Promise<Map<string, string>> {
  const roh = (await cookies()).get(COOKIE)?.value;
  if (!roh) return new Map();
  try {
    const daten: unknown = JSON.parse(roh);
    if (!daten || typeof daten !== "object" || Array.isArray(daten)) return new Map();
    return new Map(
      Object.entries(daten as Record<string, unknown>).filter(
        (paar): paar is [string, string] => typeof paar[1] === "string",
      ),
    );
  } catch {
    // Ein unlesbares Cookie ist kein Fehlerfall, sondern schlicht kein Passwort.
    return new Map();
  }
}
