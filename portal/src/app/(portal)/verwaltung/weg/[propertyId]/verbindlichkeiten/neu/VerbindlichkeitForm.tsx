"use client";

// Formular einer Verbindlichkeit — als Client-Komponente, weil die
// KI-Belegerkennung die Felder **vorbefüllt**: Ein Server-Formular mit
// `defaultValue` kann nach dem Rendern nichts mehr entgegennehmen. Gespeichert
// wird weiterhin über die Server-Action `saveVerbindlichkeit`; hier ändert
// sich nur, dass die Felder ihren Wert kennen.
import { useRef, useState } from "react";
import { DateField, SelectField } from "@/components/fields";
import { FileInput } from "@/components/file-input";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";
import { saveVerbindlichkeit } from "../actions";
import { erkenneBeleg } from "../import-actions";

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
}: {
  propertyId: string;
  start: VerbindlichkeitWerte;
  /** Ist die KI-Belegerkennung freigeschaltet? Sonst erscheint der Block nicht. */
  belegErkennung: boolean;
}) {
  const [w, setW] = useState<VerbindlichkeitWerte>(start);
  const setze = (feld: keyof VerbindlichkeitWerte) => (wert: string) =>
    setW((alt) => ({ ...alt, [feld]: wert }));

  const belegRef = useRef<HTMLInputElement>(null);
  const [liest, setLiest] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  async function belegLesen() {
    const file = belegRef.current?.files?.[0];
    if (!file) {
      setMeldung({ ok: false, text: "Bitte zuerst eine Rechnung (PDF oder Foto) auswählen." });
      return;
    }
    setLiest(true);
    setMeldung(null);
    try {
      const fd = new FormData();
      fd.append("propertyId", propertyId);
      fd.append("beleg", file);
      const res = await erkenneBeleg(fd);
      if (!res.ok) {
        setMeldung({ ok: false, text: res.error });
        return;
      }
      const d = res.data;
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
      }));
      const fehlt = [
        !d.amount && "Betrag",
        !d.incurredOn && "Rechnungsdatum",
        !d.title && "Bezeichnung",
      ].filter(Boolean);
      setMeldung({
        ok: true,
        text:
          fehlt.length > 0
            ? `Vorschlag übernommen — nicht erkannt: ${fehlt.join(", ")}. Bitte prüfen und ergänzen.`
            : "Vorschlag übernommen. Bitte alle Felder prüfen, bevor Sie speichern.",
      });
    } catch {
      setMeldung({ ok: false, text: "Die Erkennung ist fehlgeschlagen. Bitte von Hand ausfüllen." });
    } finally {
      setLiest(false);
    }
  }

  return (
    <form action={saveVerbindlichkeit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      {w.id ? <input type="hidden" name="id" value={w.id} /> : null}

      {belegErkennung ? (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-light/50 p-4 sm:col-span-2">
          <p className="text-sm font-semibold text-brand-green">Rechnung hochladen — Felder per KI vorbefüllen</p>
          <p className="mt-0.5 text-xs text-gray-600">
            Die Rechnung wird zum Lesen vollständig an Google Gemini übermittelt. Die erkannten
            Werte sind ein Vorschlag — gespeichert wird erst, wenn Sie das Formular abschicken.
            Der Beleg selbst wird hier nicht abgelegt.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <FileInput
              inputRef={belegRef}
              accept="application/pdf,image/jpeg,image/png,image/webp"
              capture="environment"
              label="Rechnung wählen"
            />
            <button
              type="button"
              onClick={belegLesen}
              disabled={liest}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-orange-dark disabled:opacity-60"
            >
              {liest ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
                  </svg>
                  Wird gelesen…
                </>
              ) : (
                "Aus Rechnung übernehmen"
              )}
            </button>
          </div>
          {meldung ? (
            <p className={`mt-2 text-xs ${meldung.ok ? "text-brand-green" : "text-red-600"}`}>
              {meldung.text}
            </p>
          ) : null}
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
