"use client";

// Die Tarife der Preisseite mit dem Einheiten-Regler darüber.
//
// Der Regler und die Karten gehören zusammen in eine Komponente, weil die
// große Zahl in der Karte selbst umschaltet: Beim ersten Aufschlagen steht
// dort der Preis JE EINHEIT — die Zahl, die man vergleicht. Sobald jemand den
// Regler anfasst, wird daraus der Monatsbetrag für genau seine Gemeinschaft,
// und die Zeile darunter sagt es auch: „Preis für Ihre WEG".
//
// Vorher stand hier ein Rechner mit Plus/Minus-Knöpfen unterhalb der Karten.
// Der Regler zeigt die Mengenstaffel als das, was sie ist: eine Bewegung —
// je weiter nach rechts, desto günstiger die einzelne Einheit.
//
// Alle Beträge kommen aus ./preise-daten und nur von dort.
import { useId, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  BRAND_EMAIL,
  wpButtonClass,
  wpButtonSecondaryClass,
} from "@/components/marketing/brand";
import {
  BASIC_JE_EINHEIT_EUR,
  jeEinheitNachStaffel,
  MAX_EINHEITEN,
  MIN_EINHEITEN,
  monatspreisGesamt,
  PLUS_JE_EINHEIT_EUR,
  RABATT_STAFFEL,
  rabattFuer,
  START_EINHEITEN,
  STELLPLATZ_JE_MONAT_EUR,
} from "./preise-daten";

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tarif = {
  name: string;
  /** Grundpreis je Einheit; null für den kostenlosen Einstieg. */
  jeEinheit: number | null;
  beschreibung: string;
  punkte: string[];
  cta: { text: string; href: string; primaer: boolean };
};

const TARIFE: Tarif[] = [
  {
    name: "Start",
    jeEinheit: null,
    beschreibung:
      "Richten Sie Ihre WEG vollständig ein und sehen Sie sich alles an – " +
      "ohne Zahlungsdaten, ohne Frist im Nacken.",
    punkte: [
      "WEG anlegen: Einheiten, Miteigentumsanteile, Konten",
      "Kostenarten aus dem WEG-Standardkatalog",
      "Miteigentümer einladen und Rollen vergeben",
      "Alle Funktionen ansehen und ausprobieren",
    ],
    cta: { text: "Kostenlos starten", href: "/registrieren", primaer: false },
  },
  {
    name: "Basic",
    jeEinheit: BASIC_JE_EINHEIT_EUR,
    beschreibung:
      "Die komplette Selbstverwaltung. Alle Zugänge inklusive – Eigentümer, " +
      "Beirat und Mieter zählen nicht extra.",
    punkte: [
      "Wirtschaftsplan mit Assistent und Beschlussvorlage (§ 28 WEG)",
      "Jahresabrechnung mit Kontenprüfung, § 35a-Ausweis, Vermögensbericht",
      "Hausgeld, Mahnwesen als DIN-A4-Brief, SEPA-Einzug",
      "Buchhaltung mit CSV-Bankimport und Belegen",
      "Versammlung, Abstimmung nach Kopf, MEA oder Objekt, Beschluss-Sammlung",
      "Dokumente, Aushänge, Schadensmeldungen mit Foto",
      "Unbegrenzte Zugänge für Eigentümer, Beirat und Mieter",
    ],
    cta: { text: "Mit Basic starten", href: "/registrieren", primaer: true },
  },
  {
    name: "Verwalter-Plus",
    jeEinheit: PLUS_JE_EINHEIT_EUR,
    beschreibung:
      "Alles aus Basic – plus ein direkter Draht zu einem zertifizierten " +
      "Verwalter (§ 26a WEG), wenn Ihre Gemeinschaft fachlichen Rat braucht.",
    punkte: [
      "Alle Funktionen und Zugänge aus Basic",
      "Ticket-System für Anfragen an einen zertifizierten Verwalter",
      "Antworten von echten Verwaltungs-Profis, dokumentiert im Portal",
      "Für die Fälle, in denen die Gemeinschaft Rückendeckung will – " +
        "Abrechnungsfragen, Beschlussformulierungen, schwierige Einzelfälle",
    ],
    cta: { text: "Mit Verwalter-Plus starten", href: "/registrieren", primaer: false },
  },
];

/** Die große Zahl einer Tarifkarte — vor und nach dem ersten Reglerzug. */
function Kartenpreis({
  jeEinheit,
  einheiten,
  stellplaetze,
  gerechnet,
}: {
  jeEinheit: number | null;
  einheiten: number;
  stellplaetze: number;
  gerechnet: boolean;
}) {
  if (jeEinheit === null) {
    return (
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums text-wp-ink">0 €</span>
        <span className="ml-2 text-sm font-medium text-wp-ink/60">zum Kennenlernen</span>
      </p>
    );
  }

  const rabatt = rabattFuer(einheiten);
  const jeEinheitJetzt = jeEinheitNachStaffel(jeEinheit, einheiten);

  return (
    <>
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums text-wp-ink" data-gesamt>
          {euro(gerechnet ? monatspreisGesamt(jeEinheit, einheiten, stellplaetze) : jeEinheit)} €
        </span>
        <span className="ml-2 text-sm font-medium text-wp-ink/60">
          {gerechnet ? "/ Monat" : "je Einheit / Monat"}
        </span>
      </p>
      {/* Feste Höhe, damit die Karten beim ersten Reglerzug nicht springen. */}
      <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-wp-ink/65" data-detail>
        {gerechnet ? (
          <>
            <span className="font-medium text-wp-accent-ink">Preis für Ihre WEG</span> ·{" "}
            {einheiten} Einheiten × {euro(jeEinheitJetzt)} €
            {rabatt > 0 ? ` (${Math.round(rabatt * 100)} % Mengenrabatt)` : ""}
            {stellplaetze > 0
              ? ` + ${stellplaetze} ${stellplaetze === 1 ? "Stellplatz" : "Stellplätze"} × ${euro(STELLPLATZ_JE_MONAT_EUR)} €`
              : ""}
          </>
        ) : (
          "Alle Zugänge inklusive. Regler oben bewegen für den Monatsbetrag Ihrer Gemeinschaft."
        )}
      </p>
    </>
  );
}

export function TarifBereich() {
  const [einheiten, setEinheiten] = useState(START_EINHEITEN);
  // Stellplätze & Garagen: eigene Position, 1 € je Stellplatz — ohne Staffel
  // und ohne Einfluss auf die Einheiten-Grenzen des Reglers.
  const [stellplaetze, setStellplaetze] = useState(0);
  // Erst nach dem ersten Zug am Regler zeigen die Karten den Gesamtbetrag —
  // wer die Seite nur überfliegt, soll den Preis je Einheit sehen.
  const [gerechnet, setGerechnet] = useState(false);
  const reglerId = useId();
  const stellplatzId = useId();

  const anteil = (einheiten - MIN_EINHEITEN) / (MAX_EINHEITEN - MIN_EINHEITEN);

  return (
    <div
      data-preisrechner
      data-basic={BASIC_JE_EINHEIT_EUR}
      data-plus={PLUS_JE_EINHEIT_EUR}
      data-min={MIN_EINHEITEN}
      data-max={MAX_EINHEITEN}
      data-staffel={JSON.stringify(RABATT_STAFFEL)}
    >
      {/* ── Der Regler ── */}
      <div className="rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <label htmlFor={reglerId} className="text-base font-semibold text-wp-ink">
            Wie viele Einheiten hat Ihre WEG?
          </label>
          <p className="flex items-baseline gap-2">
            <span
              className="text-4xl font-semibold tabular-nums leading-none text-wp-accent-ink"
              data-einheiten
            >
              {einheiten}
            </span>
            <span className="text-sm font-medium text-wp-ink/60">Einheiten</span>
          </p>
        </div>

        <input
          id={reglerId}
          type="range"
          min={MIN_EINHEITEN}
          max={MAX_EINHEITEN}
          step={1}
          value={einheiten}
          onChange={(e) => {
            setEinheiten(Number(e.target.value));
            setGerechnet(true);
          }}
          aria-valuetext={`${einheiten} Einheiten`}
          className="wp-regler mt-5 h-11 w-full cursor-pointer"
          style={{ ["--wp-regler-anteil" as string]: `${anteil * 100}%` }}
        />

        {/* Skala: die Enden und die beiden Punkte, an denen die Staffel greift.
            Die Marken stehen an ihrer echten Position auf der Schiene —
            gleichmäßig verteilt hätten sie eine falsche Stufe behauptet. */}
        <div className="relative mt-1 h-8 text-xs text-wp-ink/50">
          <span className="absolute left-0">{MIN_EINHEITEN}</span>
          <span className="absolute right-0">{MAX_EINHEITEN}</span>
          {RABATT_STAFFEL.map((stufe) => (
            <span
              key={stufe.abEinheiten}
              className="absolute -translate-x-1/2 whitespace-nowrap text-center font-medium text-wp-accent-ink"
              style={{
                left: `${
                  ((stufe.abEinheiten - MIN_EINHEITEN) / (MAX_EINHEITEN - MIN_EINHEITEN)) * 100
                }%`,
              }}
            >
              <span aria-hidden className="mx-auto mb-0.5 block h-2 w-px bg-wp-accent-ink/40" />
              ab {stufe.abEinheiten} · −{Math.round(stufe.rabatt * 100)} %
            </span>
          ))}
        </div>

        {/* ── Stellplätze & Garagen: eigene Position, flacher Preis ── */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-wp-ink/10 pt-4">
          <label htmlFor={stellplatzId} className="text-sm font-semibold text-wp-ink">
            Stellplätze &amp; Garagen
          </label>
          <input
            id={stellplatzId}
            type="number"
            min={0}
            max={99}
            value={stellplaetze}
            onChange={(e) => {
              const wert = Math.min(Math.max(Number(e.target.value) || 0, 0), 99);
              setStellplaetze(wert);
              setGerechnet(true);
            }}
            className="w-20 rounded-lg border border-wp-ink/20 bg-white px-3 py-2 text-sm tabular-nums text-wp-ink"
            aria-describedby={`${stellplatzId}-hinweis`}
          />
          <p id={`${stellplatzId}-hinweis`} className="text-sm text-wp-ink/65">
            je {euro(STELLPLATZ_JE_MONAT_EUR)} € / Monat in jedem Bezahltarif — bei
            anderen Anbietern kosten Stellplätze bis zu 2,80 €/Monat.
          </p>
        </div>
      </div>

      {/* ── Die drei Stufen ── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {TARIFE.map((tarif) => (
          <div
            key={tarif.name}
            className={`flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-7 ${
              tarif.cta.primaer ? "border-wp-accent shadow-e2" : "border-wp-ink/10 shadow-e1"
            }`}
          >
            <h2 className="text-lg font-semibold text-wp-ink">{tarif.name}</h2>
            <Kartenpreis
              jeEinheit={tarif.jeEinheit}
              einheiten={einheiten}
              stellplaetze={stellplaetze}
              gerechnet={gerechnet}
            />
            <p className="mt-3 text-sm leading-relaxed text-wp-ink/70">{tarif.beschreibung}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {tarif.punkte.map((punkt) => (
                <li key={punkt} className="flex items-start gap-2.5 text-sm text-wp-ink/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-wp-accent-ink" />
                  {punkt}
                </li>
              ))}
            </ul>
            <Link
              href={tarif.cta.href}
              className={`${tarif.cta.primaer ? wpButtonClass : wpButtonSecondaryClass} mt-6 w-full py-3`}
            >
              {tarif.cta.text}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-sm text-wp-ink/65">
        Alle Zugänge inklusive — Eigentümer, Beirat und Mieter zählen nicht
        extra. Stellplätze &amp; Garagen: {euro(STELLPLATZ_JE_MONAT_EUR)} € je
        Stellplatz/Monat in jedem Bezahltarif, im Start-Tarif kostenlos. Alle
        Preise sind Endpreise inkl. MwSt.
      </p>

      {/* Die Grenze des Self-Service — und der Weg darüber hinaus. */}
      <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-wp-ink/10 bg-[#faf8f4] p-4 text-sm leading-relaxed text-wp-ink/75">
        <strong className="font-semibold text-wp-ink">Mehr als {MAX_EINHEITEN} Einheiten?</strong>{" "}
        Dann ist Ihre Gemeinschaft bei einer professionellen Verwaltung meist besser
        aufgehoben als in der Selbstverwaltung. Schreiben Sie an{" "}
        <a
          href={`mailto:${BRAND_EMAIL}`}
          className="font-semibold text-wp-accent-ink underline decoration-wp-accent-ink/40 underline-offset-4"
        >
          {BRAND_EMAIL}
        </a>{" "}
        — die Verwaltung hinter wegportal24 meldet sich mit einem Angebot.
      </div>
    </div>
  );
}
