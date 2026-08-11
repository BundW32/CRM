"use client";

// ── Google-Ads-Tag (gtag.js) ─────────────────────────────────────────────────
//
// Zweck: Wer über eine Anzeige kommt und sich registriert, soll in Google Ads
// als Konversion ankommen — sonst optimiert die Kampagne auf Klicks statt auf
// Kunden.
//
// Zwei Bedingungen, beide müssen erfüllt sein, bevor irgendetwas an Google
// geht:
//
//   1. **Einwilligung liegt vor** (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a
//      DSGVO). Google schlägt vor, `gtag.js` sofort zu laden und den
//      Consent-Mode auf `denied` zu stellen; dabei geht aber schon ein Ping
//      hinaus. Hier wird das Skript stattdessen erst nach der Zustimmung
//      eingehängt.
//   2. **Die Seite ist eine öffentliche.** Hinter der Anmeldung stünde in fast
//      jedem Pfad eine Objekt-, Einheiten- oder Vorgangs-Kennung, und die ginge
//      als `page_path` mit hinaus. Dort wird der Consent-Mode aktiv wieder auf
//      `denied` gestellt: Das Tag bleibt vom letzten öffentlichen Seitenaufruf
//      im Speicher, und ein einmal erteiltes `granted` würde sonst im Portal
//      weitergelten.
//
// Das Grundgerüst (`dataLayer`, `gtag`) entsteht hier in JavaScript und nicht
// als Inline-Script wie bei `tracking-snippet.tsx`. Dort ist ein Snippet
// richtig, weil es **vor** der Hydratation zählen soll; hier passiert vor der
// Einwilligung ohnehin nichts, und so steht die Anlage des Gerüsts an
// derselben Stelle wie ihre einzige Verwendung — ohne ein weiteres
// `dangerouslySetInnerHTML` und ohne Angewiesenheit darauf, wie React ein
// `<script>` im Baum behandelt.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  abonniereEinwilligung,
  istWerbeseite,
  ladeEinwilligung,
  loescheWerbeCookies,
} from "@/lib/einwilligung";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Konversions-Kennung des Kontos (wegportal24.de). Sie steht hier fest und
// nicht in einer Umgebungsvariablen: Sie ist kein Geheimnis — sie steht in
// jedem ausgelieferten HTML —, und eine auf Vercel nicht gesetzte Variable
// hätte das Tag still abgeschaltet, ohne dass es jemandem auffällt.
export const GOOGLE_ADS_ID = "AW-18381571736";

const SCRIPT_ID = "google-ads-gtag";

// Ist `config` schon gelaufen? Modulweit, nicht je Baustein: Auch nach einem
// Seitenwechsel im Browser wird das Tag kein zweites Mal geladen.
let konfiguriert = false;

// Meldungen, die vor `config` eintreffen. Sie einfach abzuschicken wäre der
// Fehler: gtag.js arbeitet die Warteschlange der Reihe nach ab, und ein
// Ereignis vor der Konfiguration wird verworfen.
const wartend: (() => void)[] = [];

const ERTEILT = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
} as const;

const VERWEIGERT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

/**
 * Legt `dataLayer` und `gtag` an, falls noch nicht geschehen, und setzt den
 * Consent-Mode auf `denied`. Löst **keine** Anfrage aus — alles bleibt im
 * Browser. Der Vorrat an `denied` ist die Rückfallebene: Sollte irgendwann ein
 * anderer Baustein `gtag.js` laden, steht die Sperre schon da.
 */
function grundgeruest(): (...args: unknown[]) => void {
  if (typeof window.gtag === "function") return window.gtag;
  window.dataLayer = window.dataLayer ?? [];
  // Google erwartet ausdrücklich das `arguments`-Objekt, kein Array — gtag.js
  // unterscheidet beides beim Abarbeiten der Warteschlange. Deshalb ein
  // Funktionsausdruck ohne benannte Parameter statt Rest-Parametern.
  const gtag: (...args: unknown[]) => void = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag = gtag;
  gtag("consent", "default", { ...VERWEIGERT, analytics_storage: "denied" });
  return gtag;
}

/** Ist das Tag geladen und konfiguriert? */
export function adsBereit(): boolean {
  return konfiguriert && typeof window !== "undefined" && typeof window.gtag === "function";
}

/**
 * `fn` ausführen, sobald das Tag konfiguriert ist — sofort, wenn es das schon
 * ist. Damit hängt die Konversions-Meldung nicht daran, in welcher Reihenfolge
 * React die Effekte zweier Geschwister abarbeitet.
 */
export function beiAdsBereit(fn: () => void): void {
  if (adsBereit()) {
    fn();
    return;
  }
  wartend.push(fn);
}

function ladeTag(gtag: (...args: unknown[]) => void, id: string, pfad: string) {
  const ersteEinrichtung = !konfiguriert;
  if (ersteEinrichtung) {
    konfiguriert = true;
    if (!document.getElementById(SCRIPT_ID)) {
      const skript = document.createElement("script");
      skript.id = SCRIPT_ID;
      skript.async = true;
      skript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(skript);
    }
    gtag("js", new Date());
  }
  // `page_path` auch beim Seitenwechsel im Browser (ohne neue Anfrage an den
  // Server) — sonst kennt Google nur die Seite, auf der der Besuch begann.
  gtag("config", id, { page_path: pfad });
  if (ersteEinrichtung) {
    while (wartend.length > 0) wartend.shift()?.();
  }
}

export function GoogleAds({ id = GOOGLE_ADS_ID }: { id?: string }) {
  const pfad = usePathname() ?? "/";

  useEffect(() => {
    const anwenden = () => {
      const gtag = grundgeruest();
      const stand = ladeEinwilligung();
      if (stand?.werbung === "erteilt" && istWerbeseite(pfad)) {
        gtag("consent", "update", ERTEILT);
        ladeTag(gtag, id, pfad);
        return;
      }
      gtag("consent", "update", VERWEIGERT);
      // Widerruf: Das bereits geladene Tag lässt sich nicht mehr aus der Seite
      // nehmen, die von ihm gesetzten Cookies aber schon — und beim nächsten
      // Aufruf wird es gar nicht erst geladen.
      if (stand?.werbung === "abgelehnt") loescheWerbeCookies();
    };

    anwenden();
    return abonniereEinwilligung(anwenden);
  }, [id, pfad]);

  return null;
}
