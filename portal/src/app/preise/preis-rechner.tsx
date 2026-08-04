"use client";

// Preis-Rechner: macht die Skalierung der beiden Tarife anfassbar. Basic
// skaliert nach Nutzern, Verwalter-Plus nach Einheiten — der Rechner zeigt
// beide Monatsbeträge nebeneinander für die eigene Gemeinschaft.
//
// Die Preise stehen als Konstanten in ./preise-daten und NUR dort — Rechner,
// Tarifkarten und FAQ lesen dieselbe Quelle, sonst laufen die Zahlen beim
// nächsten Preiswechsel auseinander.
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { BASIC_JE_NUTZER_EUR, PLUS_JE_EINHEIT_EUR } from "./preise-daten";

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Zaehler({
  label,
  wert,
  setWert,
  min,
  max,
}: {
  label: string;
  wert: number;
  setWert: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-wp-ink">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setWert(Math.max(min, wert - 1))}
          disabled={wert <= min}
          aria-label={`${label} verringern`}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-wp-ink/15 text-wp-ink transition-colors hover:bg-wp-ink/5 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-lg font-semibold tabular-nums text-wp-ink">
          {wert}
        </span>
        <button
          type="button"
          onClick={() => setWert(Math.min(max, wert + 1))}
          disabled={wert >= max}
          aria-label={`${label} erhöhen`}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-wp-ink/15 text-wp-ink transition-colors hover:bg-wp-ink/5 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PreisRechner() {
  // Startwerte wie die Demo-WEG: 6 Einheiten, 8 aktive Zugänge.
  const [einheiten, setEinheiten] = useState(6);
  const [nutzer, setNutzer] = useState(8);

  return (
    <div className="rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 sm:p-8">
      <h3 className="text-lg font-semibold text-wp-ink">
        Was kostet das für Ihre Gemeinschaft?
      </h3>
      <div className="mt-5 grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <Zaehler label="Einheiten" wert={einheiten} setWert={setEinheiten} min={2} max={30} />
        <Zaehler label="Nutzer mit Zugang" wert={nutzer} setWert={setNutzer} min={1} max={60} />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-wp-primary-light p-4">
          <p className="text-sm font-medium text-wp-ink/70">Basic</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-wp-ink">
            {euro(nutzer * BASIC_JE_NUTZER_EUR)} €
            <span className="text-sm font-medium text-wp-ink/60"> / Monat</span>
          </p>
          <p className="mt-1 text-xs text-wp-ink/60">
            {nutzer} Nutzer × {euro(BASIC_JE_NUTZER_EUR)} €
          </p>
        </div>
        <div className="rounded-xl bg-wp-accent-light p-4">
          <p className="text-sm font-medium text-wp-ink/70">Verwalter-Plus</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-wp-ink">
            {euro(einheiten * PLUS_JE_EINHEIT_EUR)} €
            <span className="text-sm font-medium text-wp-ink/60"> / Monat</span>
          </p>
          <p className="mt-1 text-xs text-wp-ink/60">
            {einheiten} Einheiten × {euro(PLUS_JE_EINHEIT_EUR)} €
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-wp-ink/55">
        Die Zahl der Nutzer bestimmen Sie selbst — nur wer einen eigenen Zugang
        bekommt, zählt. Mieter-Zugänge sind Zugänge wie alle anderen.
      </p>
    </div>
  );
}
