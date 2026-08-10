// Einmalige Anzeige frisch erzeugter Wiederherstellungscodes — dasselbe Muster
// wie bei den Erst-Passwörtern (lib/zugangsschreiben.ts): Die Codes müssen
// GENAU EINMAL im Klartext zu sehen sein (zum Abschreiben/Drucken), stehen in
// der Datenbank aber nur als Hash. Eine URL scheidet aus (Protokolle, Verlauf,
// Referer), die Datenbank auch (Klartext). Bleibt das kurzlebige, pfadgebundene
// HttpOnly-Cookie über den Redirect der Server-Action hinweg.

import { cookies } from "next/headers";

const COOKIE = "mfa_codes";
const PFAD = "/mfa-einrichten";
const GUELTIG_SEKUNDEN = 5 * 60;

/** Nur aus einer Server-Action aufrufbar (Cookies setzen geht nur dort). */
export async function merkeRecoveryCodes(codes: readonly string[]): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(codes), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: PFAD,
    maxAge: GUELTIG_SEKUNDEN,
  });
}

/** Liest die gemerkten Codes; leer bei fehlendem/beschädigtem Cookie. */
export async function liesRecoveryCodes(): Promise<string[]> {
  const roh = (await cookies()).get(COOKIE)?.value;
  if (!roh) return [];
  try {
    const daten: unknown = JSON.parse(roh);
    return Array.isArray(daten) ? daten.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}
