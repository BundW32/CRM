"use client";

// Einwilligungsbanner + Nachladen des Google-Ads-Tags (gtag.js).
//
// Google gibt das Tag als zwei Zeilen „direkt hinter dem <head>-Element" aus.
// So eingebaut lädt es bei JEDEM Aufruf — also auch, bevor jemand zugestimmt
// hat. Das Tag setzt First-Party-Cookies (`_gcl_au`) zur Wiedererkennung des
// Werbeklicks; das ist ein Zugriff auf die Endeinrichtung nach § 25 Abs. 1
// TDDDG und keiner der Ausnahmefälle des Abs. 2. Und bereits das Laden des
// Skripts überträgt die IP-Adresse an Google.
//
// Deshalb kehren wir die Reihenfolge um: **erst die Entscheidung, dann das
// Tag.** Das Skript wird zur Laufzeit in den `<head>` gehängt, sobald (und nur
// wenn) eine Einwilligung vorliegt. Für Google Ads ändert das nichts an der
// Messung — die Klick-Kennung `gclid` steht in der Landing-URL und wird von
// gtag.js beim Start gelesen, gleich wann dieser Start erfolgt.
//
// Der Consent-Mode v2 wird trotzdem gesetzt: Er ist die Sprache, in der das
// Tag seinen Zustand erwartet, und hält den Weg offen, das Tag später schon
// vor der Entscheidung im Zustand „denied" zu laden.

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  CONSENT_EVENT,
  CONSENT_KEY,
  type Entscheidung,
  istTrackingPfad,
  leseEntscheidung,
} from "@/lib/consent";

const SCRIPT_ID = "google-tag";

type GtagFenster = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

function ladeTag(id: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const w = window as GtagFenster;
  const warteschlange = (w.dataLayer ??= []);
  // Google verlangt hier ausdrücklich das `arguments`-Objekt: gtag.js liest
  // die Warteschlange als Befehlsliste und erkennt ein Array an dieser Stelle
  // nicht als Befehl. Eine Rest-Parameter-Fassung sieht sauberer aus und
  // meldet danach still keine einzige Conversion.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    warteschlange.push(arguments);
  };

  w.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  w.gtag("consent", "update", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  w.gtag("js", new Date());
  w.gtag("config", id);

  const skript = document.createElement("script");
  skript.id = SCRIPT_ID;
  skript.async = true;
  skript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(skript);
}

/**
 * Widerruf: Die von Google gesetzten Kennungen müssen weg, sonst wirkt der
 * Widerruf nur nach außen. Das geladene Skript selbst lässt sich nicht
 * zurücknehmen — dafür der Neuaufbau der Seite.
 */
function loescheGoogleCookies() {
  const host = location.hostname;
  const domains = [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of ["_gcl_au", "_gcl_aw", "_gcl_dc", "_gcl_gb"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${d}`;
    }
  }
}

// ── Die Entscheidung als externer Speicher ──────────────────────────────────
// `localStorage` ist ein Zustand außerhalb von React. Ihn beim Einhängen in
// einen `useState` zu kopieren, hieße: einmal ohne, einmal mit — und für einen
// Wimpernschlag stünde das Banner auch vor denen, die längst entschieden
// haben. `useSyncExternalStore` liest stattdessen direkt und hört auf
// Änderungen; die Rückgabewerte sind Zeichenketten bzw. `null` und damit
// stabil genug für den Vergleich.

/** Nur beim Server-Rendern und während der Hydration: noch nichts bekannt. */
const UNBEKANNT = "unbekannt";
type Zustand = Entscheidung | null | typeof UNBEKANNT;

function abonniere(melde: () => void) {
  // Eigenes Ereignis für diesen Tab (`storage` feuert nur in den anderen).
  window.addEventListener(CONSENT_EVENT, melde);
  window.addEventListener("storage", melde);
  return () => {
    window.removeEventListener(CONSENT_EVENT, melde);
    window.removeEventListener("storage", melde);
  };
}

function lies(): Zustand {
  try {
    return leseEntscheidung(localStorage.getItem(CONSENT_KEY));
  } catch {
    // Speicher gesperrt (privater Modus, Richtlinie): wie „nicht entschieden".
    return null;
  }
}

function schreibe(wahl: Entscheidung | null) {
  try {
    if (wahl) localStorage.setItem(CONSENT_KEY, wahl);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* Ohne Speicher gilt die Entscheidung nur für diesen Aufruf. */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function CookieConsent({ tagId }: { tagId: string | null }) {
  const entscheidung = useSyncExternalStore<Zustand>(abonniere, lies, () => UNBEKANNT);
  const pfad = usePathname();
  const erlaubterPfad = Boolean(tagId) && istTrackingPfad(pfad ?? "");

  useEffect(() => {
    if (!tagId || !erlaubterPfad || entscheidung !== "granted") return;
    ladeTag(tagId);
  }, [tagId, erlaubterPfad, entscheidung]);

  const entscheide = useCallback((wahl: Entscheidung) => {
    schreibe(wahl);
    if (wahl === "denied") {
      loescheGoogleCookies();
      // Nur neu laden, wenn das Tag in dieser Sitzung tatsächlich lief.
      if (document.getElementById(SCRIPT_ID)) location.reload();
    }
  }, []);

  if (!erlaubterPfad || entscheidung !== null) return null;

  return (
    <div
      role="dialog"
      aria-label="Einwilligung in Werbemessung"
      className="fixed inset-x-3 bottom-3 z-50 sm:left-auto sm:right-4 sm:max-w-md"
    >
      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-xl shadow-black/20">
        <p className="text-sm font-semibold text-gray-900">
          Dürfen wir messen, was unsere Werbung bringt?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          Wir würden dafür Google Ads einsetzen. Dabei wird ein Cookie gesetzt und Ihre
          IP-Adresse an Google übertragen, auch in die USA. Ohne Ihre Einwilligung passiert
          nichts davon — die Seite funktioniert vollständig. Mehr dazu in der{" "}
          <a href="/datenschutz" className="text-brand-green underline underline-offset-2">
            Datenschutzerklärung
          </a>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => entscheide("denied")}
            className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Nur Notwendiges
          </button>
          <button
            type="button"
            onClick={() => entscheide("granted")}
            className="min-h-11 flex-1 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark"
          >
            Einverstanden
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Knopf für die Rechtsseiten: setzt die Entscheidung zurück, wodurch das Banner
 * erneut erscheint. Steht auf `/datenschutz` — ohne diesen Weg wäre eine
 * erteilte Einwilligung endgültig, und genau das verbietet Art. 7 Abs. 3 DSGVO.
 */
export function CookieEinstellungen() {
  return (
    <button
      type="button"
      onClick={() => schreibe(null)}
      className="text-brand-green underline underline-offset-2 hover:no-underline"
    >
      Einwilligung ändern oder widerrufen
    </button>
  );
}
