"use client";

// Formular einer Verbindlichkeit — als Client-Komponente, weil die
// Belegerkennung die Felder **vorbefüllt**: Ein Server-Formular mit
// `defaultValue` kann nach dem Rendern nichts mehr entgegennehmen. Gespeichert
// wird weiterhin über die Server-Action `saveVerbindlichkeit`; hier ändert
// sich nur, dass die Felder ihren Wert kennen.
//
// Zwei Wege, sichtbar getrennt: Der lokale (E-Rechnung, Text-PDF) ist immer
// da und schickt nichts nach außen. Der KI-Weg über Google erscheint nur,
// wenn er freigeschaltet ist UND der lokale Weg an dieser Datei gescheitert
// ist (Scan, Foto) — und läuft erst, nachdem die Verwaltung in einem Dialog
// ausdrücklich zugestimmt hat. Der Server prüft die Zustimmung noch einmal.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  // Der KI-Weg wird erst angeboten, wenn der lokale Weg an dieser Datei
  // nichts lesen konnte. So bleibt er die Ausnahme, nicht der erste Griff.
  const [kiAngeboten, setKiAngeboten] = useState(false);
  const [kiDialog, setKiDialog] = useState(false);

  // Escape schließt den Dialog — wie bei jeder Rückfrage im Portal.
  useEffect(() => {
    if (!kiDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKiDialog(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kiDialog]);

  async function belegLesen(weg: "lokal" | "ki", gewaehlt?: File | null) {
    const file = gewaehlt ?? belegRef.current?.files?.[0];
    if (!file) {
      setMeldung({ ok: false, text: "Bitte zuerst eine Rechnung auswählen." });
      return;
    }
    if (weg === "lokal") setKiAngeboten(false);
    setLiest(weg);
    setMeldung(null);
    try {
      const fd = new FormData();
      fd.append("propertyId", propertyId);
      fd.append("beleg", file);
      fd.append("weg", weg);
      // Die Zustimmung kommt aus dem Dialog: Dieser Aufruf ist der Klick auf
      // „Ja, an Google senden" — nichts anderes löst ihn aus.
      if (weg === "ki") fd.append("kiFreigabe", "ja");
      const res = await erkenneBeleg(fd);
      if (!res.ok) {
        setMeldung({ ok: false, text: res.error });
        if (res.kiMoeglich) setKiAngeboten(true);
        return;
      }
      setKiAngeboten(false);
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

      {/* Nur bei einer Rechnung: Ein Darlehen oder eine sonstige Verbindlichkeit
          hat keinen Beleg, aus dem sich Felder lesen ließen. Die Erkennung läuft
          beim Auswählen der Datei von selbst — ein zweiter Knopf wäre ein Schritt,
          den niemand braucht. */}
      {belegErkennung && w.kind === "RECHNUNG" ? (
        <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-light/50 p-4 sm:col-span-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-green">Rechnung als PDF wählen — die Felder füllen sich von selbst</p>
              <p className="mt-0.5 text-xs text-gray-600">
                Gelesen wird direkt im Portal, nichts verlässt den Server. Prüfen Sie die Werte,
                bevor Sie speichern. Der Beleg wird hier nicht abgelegt.
              </p>
            </div>
            <FileInput
              inputRef={belegRef}
              accept={
                kiErkennung
                  ? "application/pdf,application/xml,text/xml,.xml,image/jpeg,image/png,image/webp"
                  : "application/pdf,application/xml,text/xml,.xml"
              }
              capture={kiErkennung ? "environment" : undefined}
              label="Rechnung wählen"
              disabled={liest !== null}
              onFilesChange={(files) => {
                const file = files?.[0] ?? null;
                if (file) void belegLesen("lokal", file);
                else setMeldung(null);
              }}
            />
          </div>
          {liest === "lokal" ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-gray-600">{spinner} Rechnung wird gelesen…</p>
          ) : null}
          {meldung ? (
            <p className={`mt-2 text-xs ${meldung.ok ? "text-brand-green" : "text-red-600"}`}>
              {meldung.text}
            </p>
          ) : null}

          {kiErkennung && kiAngeboten ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-brand-orange/20 pt-3">
              <button
                type="button"
                onClick={() => setKiDialog(true)}
                disabled={liest !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {liest === "ki" ? <>{spinner} Wird gelesen…</> : "Mit KI lesen lassen"}
              </button>
              <span className="text-xs text-gray-600">
                Dafür geht die Datei an Google — Sie entscheiden das im nächsten Schritt.
              </span>
            </div>
          ) : null}

          {kiDialog ? (
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-gray-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
              onClick={() => setKiDialog(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ki-dialog-titel"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg rounded-2xl border border-gray-300 bg-white p-5 text-gray-800 shadow-2xl"
              >
                <h2 id="ki-dialog-titel" className="text-base font-bold text-gray-900">
                  Rechnung an Google senden und lesen lassen?
                </h2>
                <p className="mt-2 text-sm leading-relaxed">
                  Aus dieser Datei konnte das Portal keinen Text lesen — bei Scans und Fotos ist
                  das normal. Die KI-Erkennung kann sie trotzdem auswerten. Dafür wird die Datei
                  an Google (Gemini) übermittelt.
                </p>
                <p className="mt-3 text-sm font-semibold text-gray-900">Das sollten Sie wissen:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                  <li>
                    Google bekommt die <strong>ganze Rechnung</strong> — also auch Namen, Anschrift
                    und Bankverbindung des Rechnungsstellers und alles, was sonst darauf steht.
                  </li>
                  <li>
                    Die Verarbeitung kann außerhalb der EU stattfinden. Google ist vertraglich als
                    Auftragsverarbeiter an unsere Weisungen gebunden.
                  </li>
                  <li>
                    Sie erhalten die Werte als Vorschlag und prüfen sie, bevor Sie speichern. Im
                    Portal wird die Datei nicht abgelegt.
                  </li>
                </ul>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Für die meisten Rechnungen ist das eine gute Abkürzung. Enthält der Beleg
                  besonders Persönliches, erfassen Sie ihn lieber von Hand — das dauert eine Minute.
                  Mehr dazu unter{" "}
                  <Link href="/ki-transparenz" className="text-brand-green underline" target="_blank">
                    KI-Transparenz
                  </Link>{" "}
                  und in der{" "}
                  <Link href="/datenschutz" className="text-brand-green underline" target="_blank">
                    Datenschutzerklärung
                  </Link>
                  .
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setKiDialog(false)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
                  >
                    Lieber von Hand erfassen
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setKiDialog(false);
                      void belegLesen("ki");
                    }}
                    className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-orange-dark"
                  >
                    Ja, an Google senden
                  </button>
                </div>
              </div>
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
