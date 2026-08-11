// ── Einwilligung in Werbe-Cookies ────────────────────────────────────────────
//
// Bis zum 11.08.2026 kam dieses Portal ohne Banner aus, und das war kein
// Versäumnis, sondern der Punkt: Das eigene Zählwerk
// (`components/tracking-snippet.tsx`) schreibt nichts in den Browser — kein
// Cookie, kein localStorage —, also greift § 25 Abs. 2 Nr. 2 TDDDG und es gibt
// nichts zu fragen. Mit dem Google-Ads-Tag ändert sich genau das: Es setzt
// Cookies (`_gcl_*`) und meldet an Google. Dafür braucht es eine Einwilligung,
// und zwar **vor** dem ersten Byte an Google — ein Banner, das erst nach dem
// Laden des Tags fragt, ist keine Einwilligung, sondern eine Mitteilung.
//
// Der Zustand liegt in `localStorage`, nicht in einem Cookie: Ein Cookie liefe
// bei jeder Anfrage an den Server mit, und ausgerechnet die Einwilligung selbst
// würde damit mehr Daten übertragen, als ihr Zweck trägt. Das Merken der
// Entscheidung ist nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung zulässig —
// es ist die Umsetzung des Nutzerwunsches.

export type Werbeeinwilligung = "erteilt" | "abgelehnt";

export type Einwilligungsstand = {
  werbung: Werbeeinwilligung;
  /** Fassung des Textes, dem zugestimmt wurde — siehe `EINWILLIGUNG_FASSUNG`. */
  fassung: string;
  /** ISO-Zeitstempel der Entscheidung (Nachweis nach Art. 7 Abs. 1 DSGVO). */
  zeitpunkt: string;
};

export const EINWILLIGUNG_SCHLUESSEL = "wp-einwilligung";

// Ändert sich, worin eingewilligt wird (neuer Dienst, neuer Zweck), wird diese
// Fassung hochgesetzt. Gespeicherte Entscheidungen einer älteren Fassung gelten
// dann als nicht getroffen und das Banner fragt erneut. Ohne diesen Riegel
// würde eine Zustimmung von heute stillschweigend einen Dienst von morgen
// decken — das trägt Art. 6 Abs. 1 lit. a DSGVO nicht.
export const EINWILLIGUNG_FASSUNG = "2026-08-11";

/** Ereignis auf `window`: Die Entscheidung wurde geändert. */
export const EINWILLIGUNG_GEAENDERT = "wp-einwilligung-geaendert";

/** Ereignis auf `window`: Das Banner soll erneut geöffnet werden (Widerruf). */
export const EINWILLIGUNG_OEFFNEN = "wp-einwilligung-oeffnen";

// Seiten, auf denen das Werbe-Tag überhaupt laufen darf: die öffentlichen
// Marken- und Rechtsseiten samt Registrierungsweg. Bewusst eine Positivliste.
//
// Hinter der Anmeldung hat Google nichts zu suchen: Dort stünde in jedem Pfad
// eine Objekt-, Einheiten- oder Vorgangs-Kennung, und die ginge als `page_path`
// mit hinaus. Eine Negativliste („alles außer /verwaltung") wäre genau dann
// still undicht, wenn jemand eine neue Route anlegt — und ausgerechnet
// `/auftraege/<token>` trägt den Magic-Link des Handwerkers in der Adresse.
const OEFFENTLICHE_PFADE = [
  "/",
  "/funktionen",
  "/so-funktionierts",
  "/preise",
  "/registrieren",
  "/impressum",
  "/datenschutz",
  "/datenschutz-saas",
  "/agb",
  "/avv",
  "/widerruf",
  "/ki-transparenz",
] as const;

/**
 * Darf auf diesem Pfad ein Werbe-Tag laufen? Trifft den Pfad selbst und seine
 * Unterseiten (`/funktionen/hausgeld`), nicht aber einen Pfad, der nur so
 * anfängt (`/preise-intern`).
 */
export function istWerbeseite(pfad: string): boolean {
  const p = pfad.split("?")[0].split("#")[0];
  return OEFFENTLICHE_PFADE.some((o) => p === o || (o !== "/" && p.startsWith(`${o}/`)));
}

/**
 * Liest einen gespeicherten Stand aus seiner Rohform. Getrennt von
 * `ladeEinwilligung`, damit die Auslegung ohne Browser prüfbar bleibt.
 *
 * Gibt `null` zurück, wenn nichts gespeichert ist, der Eintrag unlesbar ist
 * oder er zu einer älteren Fassung gehört — in allen drei Fällen gilt: nicht
 * gefragt, also nichts erlaubt.
 */
export function leseEinwilligung(roh: string | null): Einwilligungsstand | null {
  if (!roh) return null;
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    return null;
  }
  if (typeof daten !== "object" || daten === null) return null;
  const satz = daten as Partial<Einwilligungsstand>;
  if (satz.werbung !== "erteilt" && satz.werbung !== "abgelehnt") return null;
  if (satz.fassung !== EINWILLIGUNG_FASSUNG) return null;
  return {
    werbung: satz.werbung,
    fassung: satz.fassung,
    zeitpunkt: typeof satz.zeitpunkt === "string" ? satz.zeitpunkt : "",
  };
}

/** Aktueller Stand aus dem Browser. Ohne Browser (Serverrendern): `null`. */
export function ladeEinwilligung(): Einwilligungsstand | null {
  if (typeof window === "undefined") return null;
  try {
    return leseEinwilligung(window.localStorage.getItem(EINWILLIGUNG_SCHLUESSEL));
  } catch {
    // Privater Modus mancher Browser wirft beim Zugriff. Dann gilt: nicht
    // gefragt — und damit nichts erlaubt.
    return null;
  }
}

/** Entscheidung festhalten und alle Zuhörer benachrichtigen. */
export function speichereEinwilligung(werbung: Werbeeinwilligung): Einwilligungsstand {
  const stand: Einwilligungsstand = {
    werbung,
    fassung: EINWILLIGUNG_FASSUNG,
    zeitpunkt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(EINWILLIGUNG_SCHLUESSEL, JSON.stringify(stand));
    } catch {
      // Lässt sich nichts speichern, gilt die Entscheidung für diesen Aufruf —
      // beim nächsten Seitenaufruf wird erneut gefragt.
    }
    window.dispatchEvent(new Event(EINWILLIGUNG_GEAENDERT));
  }
  return stand;
}

/**
 * Auf Änderungen hören. Die Reihenfolge ist zugesichert: Wer sich zuerst
 * anmeldet, wird zuerst gerufen — darauf verlässt sich das Zusammenspiel von
 * Tag-Lader und Konversions-Meldung (erst `config`, dann das Ereignis).
 *
 * `storage` kommt dazu, damit eine Entscheidung im zweiten Tab hier ankommt.
 */
export function abonniereEinwilligung(bei: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const beiSpeicher = (e: StorageEvent) => {
    if (e.key === null || e.key === EINWILLIGUNG_SCHLUESSEL) bei();
  };
  window.addEventListener(EINWILLIGUNG_GEAENDERT, bei);
  window.addEventListener("storage", beiSpeicher);
  return () => {
    window.removeEventListener(EINWILLIGUNG_GEAENDERT, bei);
    window.removeEventListener("storage", beiSpeicher);
  };
}

/** Banner erneut öffnen (Widerruf jederzeit, Art. 7 Abs. 3 DSGVO). */
export function oeffneEinwilligung(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EINWILLIGUNG_OEFFNEN));
}

/**
 * Namen der Cookies, die Google Ads im Browser ablegt. Wird die Einwilligung
 * widerrufen, hilft es nicht, nur das Tag nicht mehr zu laden: Das bereits
 * gesetzte Cookie bliebe stehen und ginge beim nächsten Besuch einer
 * Google-Domain weiter mit.
 */
export function istWerbeCookie(name: string): boolean {
  return name.startsWith("_gcl") || name.startsWith("_gac");
}

/**
 * Domänen, unter denen ein Cookie gelöscht werden muss. Ein Cookie lässt sich
 * nur mit derselben Domain-Angabe entfernen, mit der es gesetzt wurde — Google
 * setzt auf der registrierbaren Domain (`.wegportal24.de`), unser eigener Code
 * würde auf dem Host setzen. Deshalb beide Wege.
 */
export function loeschDomaenen(hostname: string): (string | null)[] {
  const teile = hostname.split(".");
  const domaenen: (string | null)[] = [null, hostname];
  if (teile.length > 1) domaenen.push(`.${teile.slice(-2).join(".")}`);
  if (teile.length > 2) domaenen.push(`.${hostname}`);
  return domaenen;
}

/** Gesetzte Werbe-Cookies entfernen. Ohne Browser: nichts zu tun. */
export function loescheWerbeCookies(): void {
  if (typeof document === "undefined") return;
  const namen = document.cookie
    .split(";")
    .map((teil) => teil.split("=")[0].trim())
    .filter((name) => name && istWerbeCookie(name));
  if (namen.length === 0) return;
  const domaenen = loeschDomaenen(window.location.hostname);
  for (const name of namen) {
    for (const domaene of domaenen) {
      document.cookie =
        `${name}=; Max-Age=0; path=/` + (domaene ? `; domain=${domaene}` : "");
    }
  }
}
