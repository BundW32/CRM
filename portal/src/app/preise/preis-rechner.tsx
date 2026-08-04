"use client";

// Preis-Rechner: EIN Regler — die Einheiten. Beide Tarife rechnen je Einheit,
// alle Zugänge sind immer inklusive; die Mengenstaffel macht die einzelne
// Einheit mit wachsender Gemeinschaft günstiger. Oberhalb von MAX_EINHEITEN
// gibt es keinen Self-Service-Tarif — der Hinweis darunter verweist auf den
// direkten Kontakt.
//
// Preise und Staffel kommen aus ./preise-daten und NUR von dort. Die
// data-Attribute am Wurzelelement spiegeln sie für die statische Chat-Vorschau
// (dort läuft kein React; ihr Treiber liest die Attribute).
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { BRAND_EMAIL } from "@/components/marketing/brand";
import {
  BASIC_JE_EINHEIT_EUR,
  jeEinheitNachStaffel,
  MAX_EINHEITEN,
  monatspreis,
  PLUS_JE_EINHEIT_EUR,
  RABATT_STAFFEL,
  rabattFuer,
} from "./preise-daten";

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TarifBox({
  name,
  basis,
  einheiten,
  ton,
}: {
  name: string;
  basis: number;
  einheiten: number;
  ton: "gruen" | "orange";
}) {
  const rabatt = rabattFuer(einheiten);
  return (
    <div className={`rounded-xl p-4 ${ton === "gruen" ? "bg-wp-primary-light" : "bg-wp-accent-light"}`}>
      <p className="text-sm font-medium text-wp-ink/70">{name}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-wp-ink" data-gesamt>
        {euro(monatspreis(basis, einheiten))} €
        <span className="text-sm font-medium text-wp-ink/60"> / Monat</span>
      </p>
      <p className="mt-1 text-xs text-wp-ink/60" data-detail>
        {einheiten} Einheiten × {euro(jeEinheitNachStaffel(basis, einheiten))} €
        {rabatt > 0 ? ` (${Math.round(rabatt * 100)} % Mengenrabatt)` : ""}
      </p>
    </div>
  );
}

export function PreisRechner() {
  // Startwert wie die Demo-WEG: 6 Einheiten.
  const [einheiten, setEinheiten] = useState(6);

  return (
    <div
      className="rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 sm:p-8"
      data-preisrechner
      data-basic={BASIC_JE_EINHEIT_EUR}
      data-plus={PLUS_JE_EINHEIT_EUR}
      data-max={MAX_EINHEITEN}
      data-staffel={JSON.stringify(RABATT_STAFFEL)}
    >
      <h3 className="text-lg font-semibold text-wp-ink">
        Was kostet das für Ihre Gemeinschaft?
      </h3>
      <div className="mt-5 flex items-center justify-between gap-3 sm:max-w-xs">
        <span className="text-sm font-medium text-wp-ink">Einheiten</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEinheiten(Math.max(2, einheiten - 1))}
            disabled={einheiten <= 2}
            aria-label="Einheiten verringern"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-wp-ink/15 text-wp-ink transition-colors hover:bg-wp-ink/5 disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-lg font-semibold tabular-nums text-wp-ink" data-einheiten>
            {einheiten}
          </span>
          <button
            type="button"
            onClick={() => setEinheiten(Math.min(MAX_EINHEITEN, einheiten + 1))}
            disabled={einheiten >= MAX_EINHEITEN}
            aria-label="Einheiten erhöhen"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-wp-ink/15 text-wp-ink transition-colors hover:bg-wp-ink/5 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <TarifBox name="Basic" basis={BASIC_JE_EINHEIT_EUR} einheiten={einheiten} ton="gruen" />
        <TarifBox name="Verwalter-Plus" basis={PLUS_JE_EINHEIT_EUR} einheiten={einheiten} ton="orange" />
      </div>
      <p className="mt-4 text-xs text-wp-ink/55">
        Alle Zugänge inklusive — Eigentümer, Beirat und Mieter zählen nicht
        extra; Handwerker arbeiten ohne Konto über sichere Auftrags-Links. Ab {RABATT_STAFFEL[1].abEinheiten} Einheiten wird
        jede Einheit {Math.round(RABATT_STAFFEL[1].rabatt * 100)} % günstiger,
        ab {RABATT_STAFFEL[0].abEinheiten} Einheiten{" "}
        {Math.round(RABATT_STAFFEL[0].rabatt * 100)} %.
      </p>
      {/* Die Grenze des Self-Service — und der Weg darüber hinaus. */}
      <div className="mt-4 rounded-xl border border-wp-ink/10 bg-[#faf8f4] p-4 text-sm leading-relaxed text-wp-ink/75">
        <strong className="font-semibold text-wp-ink">
          Mehr als {MAX_EINHEITEN} Einheiten?
        </strong>{" "}
        Dann ist Ihre Gemeinschaft bei einer professionellen Verwaltung meist
        besser aufgehoben als in der Selbstverwaltung. Schreiben Sie an{" "}
        <a href={`mailto:${BRAND_EMAIL}`} className="font-semibold text-wp-accent-ink underline decoration-wp-accent-ink/40 underline-offset-4">
          {BRAND_EMAIL}
        </a>{" "}
        — die Verwaltung hinter wegportal24 meldet sich mit einem Angebot.
      </div>
    </div>
  );
}
