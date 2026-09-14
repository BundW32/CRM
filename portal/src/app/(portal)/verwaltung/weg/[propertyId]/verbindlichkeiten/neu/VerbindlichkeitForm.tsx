"use client";

// Formular einer Verbindlichkeit — als Client-Komponente, weil die
// Belegerkennung die Felder **vorbefüllt**: Ein Server-Formular mit
// `defaultValue` kann nach dem Rendern nichts mehr entgegennehmen. Gespeichert
// wird weiterhin über die Server-Action `saveVerbindlichkeit`; hier ändert
// sich nur, dass die Felder ihren Wert kennen.
//
// Die Erkennung selbst (lokal, auf Wunsch KI mit Datenschutzdialog) steckt in
// `BelegErkennungBlock` — dieselbe wie bei „Buchung erfassen".
import { useState } from "react";
import { BelegErkennungBlock } from "@/components/beleg-erkennung-block";
import { DateField, SelectField } from "@/components/fields";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";
import { saveVerbindlichkeit } from "../actions";

export type VerbindlichkeitWerte = {
  id?: string;
  title: string;
  kind: "RECHNUNG" | "DARLEHEN" | "SONSTIGE";
  creditor: string;
  amount: string;
  incurredOn: string;
  dueDate: string;
  note: string;
};

export function VerbindlichkeitForm({
  propertyId,
  start,
  belegErkennung,
  kiErkennung,
}: {
  propertyId: string;
  start: VerbindlichkeitWerte;
  /** Den Block „Rechnung hochladen" zeigen? Beim Bearbeiten nicht. */
  belegErkennung: boolean;
  /** Ist die KI-Erkennung über Google freigeschaltet? Sonst gibt es nur den lokalen Weg. */
  kiErkennung: boolean;
}) {
  const [w, setW] = useState<VerbindlichkeitWerte>(start);
  const setze = (feld: keyof VerbindlichkeitWerte) => (wert: string) =>
    setW((alt) => ({ ...alt, [feld]: wert }));

  return (
    <form action={saveVerbindlichkeit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      {w.id ? <input type="hidden" name="id" value={w.id} /> : null}

      {/* Nur bei einer Rechnung: Ein Darlehen oder eine sonstige Verbindlichkeit
          hat keinen Beleg, aus dem sich Felder lesen ließen. Die Erkennung läuft
          beim Auswählen der Datei von selbst — ein zweiter Knopf wäre ein Schritt,
          den niemand braucht. */}
      {belegErkennung && w.kind === "RECHNUNG" ? (
        <div className="sm:col-span-2">
          <BelegErkennungBlock
            propertyId={propertyId}
            kiErkennung={kiErkennung}
            titel="Rechnung als PDF wählen — die Felder füllen sich von selbst"
            hinweis="Gelesen wird direkt im Portal, nichts verlässt den Server. Prüfen Sie die Werte, bevor Sie speichern. Der Beleg wird hier nicht abgelegt."
            onErkannt={(d) =>
              // Nur übernehmen, was erkannt wurde — eine leere Antwort löscht keine Eingabe.
              setW((alt) => ({
                ...alt,
                kind: "RECHNUNG",
                title: d.title || alt.title,
                creditor: d.creditor || alt.creditor,
                amount: d.amount || alt.amount,
                incurredOn: d.incurredOn || alt.incurredOn,
                dueDate: d.dueDate || alt.dueDate,
                note: d.note || alt.note,
              }))
            }
            fehlt={(d) =>
              [!d.amount && "Betrag", !d.incurredOn && "Rechnungsdatum", !d.title && "Bezeichnung"].filter(
                (x): x is string => Boolean(x),
              )
            }
          />
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <Field label="Bezeichnung">
          <input
            name="title"
            required
            maxLength={200}
            value={w.title}
            onChange={(e) => setze("title")(e.target.value)}
            placeholder="z. B. Rechnung 2026-114, Dachreparatur"
            className={inputClass}
          />
        </Field>
      </div>

      <SelectField
        label="Art"
        name="kind"
        value={w.kind}
        onChange={(e) => setze("kind")(e.target.value)}
        options={[
          { value: "RECHNUNG", label: "Offene Rechnung" },
          { value: "DARLEHEN", label: "Darlehen" },
          { value: "SONSTIGE", label: "Sonstige Verbindlichkeit" },
        ]}
      />

      <Field label="Gläubiger">
        <input
          name="creditor"
          maxLength={160}
          value={w.creditor}
          onChange={(e) => setze("creditor")(e.target.value)}
          placeholder="Wem die Gemeinschaft das schuldet"
          className={inputClass}
        />
      </Field>

      <Field label="Offener Betrag (€)">
        <input
          name="amount"
          required
          inputMode="decimal"
          value={w.amount}
          onChange={(e) => setze("amount")(e.target.value)}
          placeholder="1.250,00"
          className={inputClass}
        />
      </Field>

      <DateField
        label="Entstanden am"
        name="incurredOn"
        required
        value={w.incurredOn}
        onChange={(e) => setze("incurredOn")(e.target.value)}
      />

      <DateField
        label="Fällig am"
        name="dueDate"
        value={w.dueDate}
        onChange={(e) => setze("dueDate")(e.target.value)}
      />

      <div className="sm:col-span-2">
        <Field label="Notiz">
          <input
            name="note"
            maxLength={1000}
            value={w.note}
            onChange={(e) => setze("note")(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Wird gespeichert…">
          {w.id ? "Änderungen speichern" : "Verbindlichkeit erfassen"}
        </SubmitButton>
      </div>
    </form>
  );
}
