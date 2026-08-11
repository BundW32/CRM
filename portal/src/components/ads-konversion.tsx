"use client";

// Meldet eine Konversion an Google Ads — den einen Vorgang, für den die
// Kampagne bezahlt wird. Ohne diese Meldung sieht Google nur Klicks und kann
// nicht auf Registrierungen optimieren; das Tag allein reicht dafür nicht.
//
// Das Ziel (`AW-…/<Label>`) entsteht erst, wenn im Google-Ads-Konto eine
// Konversionsaktion angelegt wurde. Es steht deshalb in einer
// Umgebungsvariablen und nicht im Quelltext: Fehlt sie, meldet dieser Baustein
// nichts — er ist dann ein `null`-Rendern ohne Nebenwirkung, kein Fehler.

import { useEffect } from "react";
import { beiAdsBereit } from "./google-ads";
import { abonniereEinwilligung, ladeEinwilligung } from "@/lib/einwilligung";

// `NEXT_PUBLIC_*` wird beim Bauen eingesetzt und muss deshalb wörtlich
// dastehen — ein berechneter Zugriff (`process.env[name]`) bliebe leer.
const ZIELE = {
  registrierung: process.env.NEXT_PUBLIC_GOOGLE_ADS_KONVERSION_REGISTRIERUNG,
} as const;

export type Konversion = keyof typeof ZIELE;

const GEMELDET_SCHLUESSEL = "wp-ads-konversion";

function schonGemeldet(ereignis: Konversion): boolean {
  try {
    return window.localStorage.getItem(`${GEMELDET_SCHLUESSEL}:${ereignis}`) !== null;
  } catch {
    return false;
  }
}

function merkeGemeldet(ereignis: Konversion): void {
  try {
    window.localStorage.setItem(`${GEMELDET_SCHLUESSEL}:${ereignis}`, new Date().toISOString());
  } catch {
    // Lässt sich nichts merken, zählt ein erneutes Aufrufen der Seite doppelt.
    // Das ist der harmlosere der beiden Fehler — die Meldung ganz zu verlieren
    // wäre der teurere.
  }
}

/**
 * Auf der Seite platzieren, die den erfolgreichen Vorgang bestätigt — nicht
 * auf dem Formular davor. Meldet höchstens einmal je Browser.
 */
export function AdsKonversion({ ereignis }: { ereignis: Konversion }) {
  useEffect(() => {
    const ziel = ZIELE[ereignis];
    if (!ziel) return;

    const melde = () => {
      if (ladeEinwilligung()?.werbung !== "erteilt") return;
      beiAdsBereit(() => {
        if (schonGemeldet(ereignis)) return;
        window.gtag?.("event", "conversion", { send_to: ziel });
        merkeGemeldet(ereignis);
      });
    };

    melde();
    // Wurde noch nicht eingewilligt, kommt die Entscheidung erst aus dem
    // Banner — dann von vorn.
    return abonniereEinwilligung(melde);
  }, [ereignis]);

  return null;
}
