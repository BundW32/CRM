"use client";

// Formular einer Verbindlichkeit — als Client-Komponente, weil die
// Belegerkennung die Felder **vorbefüllt**: Ein Server-Formular mit
// `defaultValue` kann nach dem Rendern nichts mehr entgegennehmen. Gespeichert
// wird weiterhin über die Server-Action `saveVerbindlichkeit`; hier ändert
// sich nur, dass die Felder ihren Wert kennen.
//
// Zwei Wege, sichtbar getrennt: Der lokale (E-Rechnung, Text-PDF) ist immer
// da und schickt nichts nach außen. Der KI-Weg über Google erscheint nur,
// wenn er freigeschaltet ist, und läuft erst nach einem gesetzten Häkchen
// unter dem Datenschutzhinweis — der Server prüft das Häkchen noch einmal.
import Link from "next/link";
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

  const belegRef = useRef<HTMLInputElement>(null);
  const [liest, setLiest] = useState<"lokal" | "ki" | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [kiFreigabe, setKiFreigabe] = useState(false);
  // Der KI-Weg klappt erst auf, wenn der lokale Weg nichts lesen konnte —
  // oder auf Wunsch. So bleibt er die Ausnahme, nicht der erste Griff.
  const [kiOffen, setKiOffen] = useState(false);

  async function belegLesen(weg: "lokal" | "ki") {
    const file = belegRef.current?.files?.[0];
    if (!file) {
      setMeldung({ ok: false, text: "Bitte zuerst eine Rechnung auswählen." });
      return;
    }
    if (weg === "ki" && !kiFreigabe) {
      setMeldung({ ok: false, text: "Bitte bestätigen Sie zuerst den Datenschutzhinweis." });
      return;
    }
    setLiest(weg);
    setMeldung(null);
    try {
      const fd = new FormData();
      fd.append("propertyId", propertyId);
      fd.append("beleg", file);
      fd.append("weg", weg);
      if (weg === "ki") fd.append("kiFreigabe", "ja");
      const res = await erkenneBeleg(fd);
      if (!res.ok) {
        setMeldung({ ok: false, text: res.error });
        if (res.kiMoeglich) setKiOffen(true);
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
      const quelle =
        res.quelle === "e-rechnung"
          ? "aus der E-Rechnung (XML) gelesen"
          : res.quelle === "text"
            ? "aus dem Text der PDF gelesen"
            : "von der KI vorgeschlagen";
      setMeldung({
        ok: true,
        text:
          fehlt.length > 0
            ? `Werte ${quelle} — nicht erkannt: ${fehlt.join(", ")}. Bitte prüfen und ergänzen.`
            : `Werte ${quelle}. Bitte alle Felder prüfen, bevor Sie speichern.`,
      });
    } catch {
      setMeldung({ ok: false, text: "Die Erkennung ist fehlgeschlagen. Bitte von Hand ausfüllen." });
    } finally {
      setLiest(null);
    }
  }

  const spinner = (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
    </svg>
  );

  return (
    <form action={saveVerbindlichkeit} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      {w.id ? <input type="hidden" name="id" value={w.id} /> : null}

      {belegErkennung ? (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-light/50 p-4 sm:col-span-2">
          <p className="text-sm font-semibold text-brand-green">Rechnung hochladen — Felder vorbefüllen</p>
          <p className="mt-0.5 text-xs text-gray-600">
            E-Rechnungen (ZUGFeRD, XRechnung) und PDF-Rechnungen mit Textebene werden direkt im
            Portal gelesen. Dabei verlässt nichts den Server. Die erkannten Werte sind ein
            Vorschlag — gespeichert wird erst, wenn Sie das Formular abschicken. Der Beleg
            selbst wird hier nicht abgelegt.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <FileInput
              inputRef={belegRef}
              accept={
                kiErkennung
                  ? "application/pdf,application/xml,text/xml,.xml,image/jpeg,image/png,image/webp"
                  : "application/pdf,application/xml,text/xml,.xml"
              }
              capture={kiErkennung ? "environment" : undefined}
              label="Rechnung wählen"
            />
            <button
              type="button"
              onClick={() => belegLesen("lokal")}
              disabled={liest !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-orange-dark disabled:opacity-60"
            >
              {liest === "lokal" ? <>{spinner} Wird gelesen…</> : "Aus Rechnung übernehmen"}
            </button>
          </div>
          {meldung ? (
            <p className={`mt-2 text-xs ${meldung.ok ? "text-brand-green" : "text-red-600"}`}>
              {meldung.text}
            </p>
          ) : null}

          {kiErkennung ? (
            <div className="mt-4 border-t border-brand-orange/20 pt-3">
              {!kiOffen ? (
                <button
                  type="button"
                  onClick={() => setKiOffen(true)}
                  className="text-xs text-gray-600 underline-offset-2 hover:underline"
                >
                  Scan oder Foto? Mit KI lesen lassen (Übermittlung an Google) …
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">
                    KI-Erkennung über Google — nur nach Ihrer Bestätigung
                  </p>
                  <p className="text-xs text-gray-700">
                    <strong>Datenschutzhinweis:</strong> Die Datei wird{" "}
                    <strong>vollständig</strong> an die Gemini-API von Google übermittelt — mit
                    allem, was auf ihr steht: Name und Bankverbindung des Rechnungsstellers,
                    gegebenenfalls Namen von Eigentümern oder Mietern. Eine Verarbeitung
                    außerhalb der EU ist dabei möglich. Google handelt als unser
                    Auftragsverarbeiter; ob die Weitergabe dieser Rechnung vertretbar ist,
                    entscheiden Sie als verantwortliche Stelle. Einzelheiten unter{" "}
                    <Link href="/ki-transparenz" className="text-brand-green underline" target="_blank">
                      KI-Transparenz
                    </Link>{" "}
                    und in der{" "}
                    <Link href="/datenschutz" className="text-brand-green underline" target="_blank">
                      Datenschutzerklärung
                    </Link>
                    . Ohne dieses Häkchen wird nichts übermittelt.
                  </p>
                  <label className="flex items-start gap-2 text-xs text-gray-800">
                    <input
                      type="checkbox"
                      checked={kiFreigabe}
                      onChange={(e) => setKiFreigabe(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Ich habe den Hinweis gelesen und möchte diese Rechnung zur Erkennung an
                      Google übermitteln.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => belegLesen("ki")}
                    disabled={liest !== null || !kiFreigabe}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    {liest === "ki" ? <>{spinner} Wird an Google übermittelt…</> : "Mit KI lesen (Google)"}
                  </button>
                </div>
              )}
            </div>
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
