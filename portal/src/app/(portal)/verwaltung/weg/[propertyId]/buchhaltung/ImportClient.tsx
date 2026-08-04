"use client";

// CSV-Import-Assistent (Zero-Key): Schritt 1 Datei + Konto → Analyse mit
// Mapping-Vorschlag und Duplikat-Vorschau, Schritt 2 bestätigen → Import.
// Der Dateiinhalt reist als Base64 im Formular mit — nichts wird serverseitig
// zwischengespeichert.
import { useActionState } from "react";
import { FileInput } from "@/components/file-input";
import { buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { analyzeCsvAction, importCsvAction, type ImportAnalysis } from "./actions";

type AccountOption = { id: string; name: string };

export function ImportClient({
  propertyId,
  accounts,
}: {
  propertyId: string;
  accounts: AccountOption[];
}) {
  const [analysis, analyzeAction, analyzing] = useActionState<ImportAnalysis | null, FormData>(
    analyzeCsvAction,
    null,
  );

  const mappingReady =
    analysis?.ok &&
    analysis.mapping.date !== undefined &&
    analysis.mapping.amount !== undefined &&
    analysis.mapping.purpose !== undefined;

  return (
    <div className="grid gap-4">
      {/* Schritt 1: Datei + Konto */}
      <form action={analyzeAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="propertyId" value={propertyId} />
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Konto</span>
          <select name="accountId" className={`${inputClass} w-auto`} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            CSV-Datei (Sparkasse, Volksbank, generisch)
          </span>
          <FileInput
            name="csv"
            accept=".csv,text/csv"
            required
          />
        </label>
        <button type="submit" className={buttonClass} disabled={analyzing}>
          {analyzing ? "Wird analysiert…" : "Datei analysieren"}
        </button>
      </form>

      {analysis && !analysis.ok ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {analysis.error}
        </p>
      ) : null}

      {/* Schritt 2: Mapping bestätigen + Vorschau */}
      {analysis?.ok ? (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {analysis.fileName} · {analysis.rowsTotal} Zeilen, davon {analysis.parseable} lesbar
            {analysis.duplicates > 0 ? `, ${analysis.duplicates} Duplikat(e) werden übersprungen` : ""}
          </h3>

          <form action={analyzeAction} className="mt-3 flex flex-wrap items-end gap-2">
            {/* erneute Analyse mit angepasstem Mapping */}
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="accountId" value={analysis.accountId} />
            <input type="hidden" name="contentBase64" value={analysis.contentBase64} />
            <input type="hidden" name="fileName" value={analysis.fileName} />
            <MappingSelect header={analysis.header} name="col_date" label="Spalte Buchungstag" value={analysis.mapping.date} />
            <MappingSelect header={analysis.header} name="col_amount" label="Spalte Betrag" value={analysis.mapping.amount} />
            <MappingSelect header={analysis.header} name="col_purpose" label="Spalte Verwendungszweck" value={analysis.mapping.purpose} />
            <MappingSelect header={analysis.header} name="col_counterparty" label="Spalte Zahlungspartner (optional)" value={analysis.mapping.counterparty} optional />
            <button type="submit" className={buttonSecondaryClass} disabled={analyzing}>
              Vorschau aktualisieren
            </button>
          </form>

          {mappingReady ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1.5 pr-3">Datum</th>
                      <th className="py-1.5 pr-3">Art</th>
                      <th className="py-1.5 pr-3">Betrag</th>
                      <th className="py-1.5 pr-3">Text</th>
                      <th className="py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.preview.slice(0, 20).map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 ${row.duplicate ? "text-gray-400 line-through" : "text-gray-800"}`}
                      >
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatDe(row.date)}</td>
                        <td className="py-1.5 pr-3">{row.kind === "EINNAHME" ? "Einnahme" : "Ausgabe"}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{row.amountLabel}</td>
                        <td className="py-1.5 pr-3">{truncate(row.text, 60)}</td>
                        <td className="py-1.5">{row.duplicate ? "Duplikat" : "neu"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analysis.preview.length > 20 ? (
                  <p className="mt-1 text-xs text-gray-400">
                    … und {analysis.preview.length - 20} weitere Zeilen.
                  </p>
                ) : null}
              </div>

              <form action={importCsvAction} className="mt-4">
                <input type="hidden" name="propertyId" value={propertyId} />
                <input type="hidden" name="accountId" value={analysis.accountId} />
                <input type="hidden" name="contentBase64" value={analysis.contentBase64} />
                <input type="hidden" name="fileName" value={analysis.fileName} />
                <input type="hidden" name="col_date" value={analysis.mapping.date} />
                <input type="hidden" name="col_amount" value={analysis.mapping.amount} />
                <input type="hidden" name="col_purpose" value={analysis.mapping.purpose} />
                {analysis.mapping.counterparty !== undefined ? (
                  <input type="hidden" name="col_counterparty" value={analysis.mapping.counterparty} />
                ) : null}
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={analysis.parseable - analysis.duplicates <= 0}
                >
                  {analysis.parseable - analysis.duplicates} Buchung(en) importieren
                </button>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              Die Spalten für Buchungstag, Betrag und Verwendungszweck konnten nicht
              automatisch erkannt werden — bitte oben zuordnen und „Vorschau
              aktualisieren“ wählen.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MappingSelect({
  header,
  name,
  label,
  value,
  optional = false,
}: {
  header: string[];
  name: string;
  label: string;
  value: number | undefined;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={`${inputClass} w-auto`}>
        {optional ? <option value="">— keine —</option> : <option value="">bitte wählen</option>}
        {header.map((h, i) => (
          <option key={i} value={i}>
            {h || `Spalte ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
