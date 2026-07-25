"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { NewUserForm } from "../nutzer/new-user-form";
import { createCraftsman } from "./actions";
import type { ContactKind } from "@/generated/prisma/client";
import { contactKindLabels, kindUsesTrade, tradeLabels } from "@/lib/labels";

type Property = { id: string; name: string };

// Die Art des Kontakts ist die einzige Frage, die am Anfang steht – alles
// Weitere folgt daraus.
//
// Vorher standen hier zwei getrennte Karten: „Person mit Zugang anlegen" oben
// und „Kontakt hinzufügen" darunter. Damit musste man vorab wissen, ob jemand
// einen Portalzugang bekommt, um überhaupt das richtige Formular zu treffen –
// die Weiche stand also verkehrt herum. Fachlich entscheidet die Rolle, und der
// Zugang folgt ihr: Zugang haben Verwalter, Mieter und Eigentümer, alle übrigen
// Arten sind reine Karteikarten.
//
// Zwei Server-Actions bleiben dahinter (Personen und Karteikarten sind
// verschiedene Tabellen); nach außen ist es ein Formular mit einer Weiche.

/** Rollen mit Portalzugang – hier steht, wer ein Konto bekommt. */
const ZUGANGS_ROLLEN = ["MIETER", "EIGENTUEMER", "VERWALTER"] as const;
type ZugangsRolle = (typeof ZUGANGS_ROLLEN)[number];

const zugangsRollenLabels: Record<ZugangsRolle, string> = {
  MIETER: "Mieter",
  EIGENTUEMER: "Eigentümer",
  VERWALTER: "Verwalter",
};

const KARTEI_ARTEN = Object.keys(contactKindLabels) as ContactKind[];
const TRADE_ORDER = Object.keys(tradeLabels) as Array<keyof typeof tradeLabels>;

type Auswahl = ZugangsRolle | ContactKind;

function istZugangsRolle(wert: Auswahl): wert is ZugangsRolle {
  return (ZUGANGS_ROLLEN as readonly string[]).includes(wert);
}

export function KontaktAnlegen({
  properties,
  isSuperAdmin,
  selfManaged,
}: {
  properties: Property[];
  isSuperAdmin: boolean;
  selfManaged: boolean;
}) {
  // Selbstverwaltung kennt keine Mieter-Konten (kein professionelles
  // Mietverhältnis) – die Vorauswahl beginnt dort beim Eigentümer.
  const [art, setArt] = useState<Auswahl>(selfManaged ? "EIGENTUEMER" : "MIETER");

  const zugang = istZugangsRolle(art);
  const verfuegbareRollen = ZUGANGS_ROLLEN.filter((r) => {
    if (r === "MIETER" && selfManaged) return false;
    if (r === "VERWALTER" && !isSuperAdmin) return false;
    return true;
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Kontakt anlegen</h2>
      <p className="mb-4 text-xs text-gray-500">
        Die Art entscheidet über alles Weitere – auch darüber, ob ein Portalzugang
        entsteht.
      </p>

      <Field label="Art">
        <select
          className={inputClass}
          value={art}
          onChange={(e) => setArt(e.target.value as Auswahl)}
        >
          <optgroup label="Mit Portalzugang">
            {verfuegbareRollen.map((r) => (
              <option key={r} value={r}>
                {zugangsRollenLabels[r]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ohne Portalzugang">
            {KARTEI_ARTEN.map((k) => (
              <option key={k} value={k}>
                {contactKindLabels[k]}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <p className="mb-4 mt-2 text-xs text-gray-500">
        {zugang ? (
          <>
            Erhält einen <strong>Portalzugang</strong> – per E-Mail-Einladung oder
            Zugangsschreiben.
          </>
        ) : (
          <>
            Wird als <strong>Karteikarte ohne Zugang</strong> geführt. Handwerker
            bekommen ihre Aufträge per E-Mail-Link.
          </>
        )}
      </p>

      {/* Beide Formulare bleiben eigenständig – sie schreiben in verschiedene
          Tabellen. `key` erzwingt beim Wechsel der Art einen frischen Zustand,
          damit keine Eingaben aus dem anderen Zweig hängen bleiben. */}
      {zugang ? (
        <NewUserForm
          key={art}
          zurueck="/verwaltung/kontakte"
          properties={properties}
          isSuperAdmin={isSuperAdmin}
          selfManaged={selfManaged}
          presetRole={art}
        />
      ) : (
        <KarteiFormular key={art} kind={art as ContactKind} />
      )}
    </div>
  );
}

/** Karteikarte ohne Zugang: Handwerker, Dienstleister, Versorger, Behörden. */
function KarteiFormular({ kind }: { kind: ContactKind }) {
  return (
    <form action={createCraftsman} className="space-y-3">
      {/* Die Art kommt aus der Auswahl oben – hier nur noch mitschicken. */}
      <input type="hidden" name="kind" value={kind} />
      {/* Ein Gewerk führen nur Handwerker. `Craftsman.trade` ist im Schema aber
          ein Pflichtfeld, deshalb bei allen anderen Arten der vorgesehene
          Sammelwert. */}
      {kindUsesTrade(kind) ? (
        <Field label="Gewerk">
          <select name="trade" required className={inputClass} defaultValue="SANITAER">
            {TRADE_ORDER.map((t) => (
              <option key={t} value={t}>
                {tradeLabels[t]}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="trade" value="ALLGEMEIN" />
      )}
      <Field label="Firma (optional)">
        <input
          type="text"
          name="company"
          className={inputClass}
          placeholder="z. B. Müller Sanitär GmbH"
        />
      </Field>
      <Field label="Ansprechpartner / Name">
        <input type="text" name="name" required minLength={2} className={inputClass} />
      </Field>
      <Field label="Telefon">
        <input type="tel" name="phone" className={inputClass} />
      </Field>
      <Field label="E-Mail">
        <input type="email" name="email" className={inputClass} />
      </Field>
      <Field label="Bevorzugter Kontaktweg">
        <select name="preferredContact" required className={inputClass} defaultValue="TELEFON">
          {[
            ["EMAIL", "E-Mail"],
            ["TELEFON", "Telefon"],
            ["MOBIL", "Mobil"],
            ["POST", "Post"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notizen (optional)">
        <textarea
          name="notes"
          rows={2}
          className={inputClass}
          placeholder="z. B. Verfügbarkeiten, Konditionen"
        />
      </Field>
      {/* Eigenleistung gibt es nur bei Handwerkern – bei einer Behörde wäre die
          Frage sinnlos. */}
      {kindUsesTrade(kind) ? (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="isInternal" className="mt-0.5" />
          <span>
            <span className="font-medium">Intern (Eigenleistung)</span>
            <span className="block text-xs text-gray-500">
              Wird bei der Vorgangszuordnung zuerst angeboten. Externe können erst nach
              ausdrücklicher Freigabe beauftragt werden.
            </span>
          </span>
        </label>
      ) : null}
      <SubmitButton pendingLabel="Wird gespeichert…">Speichern</SubmitButton>
    </form>
  );
}
