"use client";

// CSV-Import-Assistent (Zero-Key): Schritt 1 Datei + Konto → Analyse mit
// Mapping-Vorschlag, Duplikat- und Zuordnungs-Vorschau, Schritt 2 bestätigen →
// Import. Der Dateiinhalt reist als Base64 im Formular mit — nichts wird
// serverseitig zwischengespeichert.
//
// Der Assistent zeigt **immer**, was er gelesen hat: Zeichensatz, Trennzeichen,
// ob eine Kopfzeile gefunden wurde, und die ersten Rohzeilen. Ohne diese
// Angaben unterscheidet niemand „falsche Zeile als Kopfzeile" von „Zeichensatz
// kaputt" — beide sehen von außen gleich aus, und beide sind schon vorgekommen.
import { useActionState } from "react";
import { Badge } from "@/components/data-display";
import { FileInput } from "@/components/file-input";
import { buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import type { Guete } from "@/lib/weg/zuordnung-vorschlag";
import {
  analyzeCsvAction,
  importCsvAction,
  type ImportAnalysis,
  type ImportDiagnose,
  type ImportVorschlag,
} from "./actions";

type AccountOption = { id: string; name: string };

const ZEICHENSATZ_TEXT: Record<string, string> = {
  "utf-8": "UTF-8",
  "utf-8-bom": "UTF-8 (mit BOM)",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "windows-1252": "Windows-1252",
};

const TRENNZEICHEN_TEXT: Record<string, string> = {
  ";": "Semikolon (;)",
  ",": "Komma (,)",
  "\t": "Tabulator",
  "|": "Senkrechter Strich (|)",
};

const GUETE_TON: Record<Guete, "success" | "warning" | "neutral"> = {
  sicher: "success",
  wahrscheinlich: "warning",
  unsicher: "neutral",
};

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
    analysis.mapping.purpose !== undefined &&
    (analysis.mapping.amount !== undefined ||
      analysis.mapping.debit !== undefined ||
      analysis.mapping.credit !== undefined);

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
        <div className="grid gap-3">
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {analysis.error}
          </p>
          {analysis.diagnose ? <Diagnose diagnose={analysis.diagnose} /> : null}
        </div>
      ) : null}

      {/* Schritt 2: Mapping bestätigen + Vorschau */}
      {analysis?.ok ? (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {analysis.fileName} · {analysis.rowsTotal} Zeilen, davon {analysis.parseable} lesbar
            {analysis.duplicates > 0 ? `, ${analysis.duplicates} Duplikat(e) werden übersprungen` : ""}
          </h3>

          <Diagnose diagnose={analysis.diagnose} className="mt-3" />

          <form action={analyzeAction} className="mt-3 flex flex-wrap items-end gap-2">
            {/* erneute Analyse mit angepasstem Mapping */}
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="accountId" value={analysis.accountId} />
            <input type="hidden" name="contentBase64" value={analysis.contentBase64} />
            <input type="hidden" name="fileName" value={analysis.fileName} />
            <input type="hidden" name="encoding" value={analysis.diagnose.encoding} />
            <MappingSelect header={analysis.header} name="col_date" label="Spalte Buchungstag" value={analysis.mapping.date} />
            <MappingSelect header={analysis.header} name="col_amount" label="Spalte Betrag" value={analysis.mapping.amount} optional />
            <MappingSelect header={analysis.header} name="col_debit" label="Spalte Soll (optional)" value={analysis.mapping.debit} optional />
            <MappingSelect header={analysis.header} name="col_credit" label="Spalte Haben (optional)" value={analysis.mapping.credit} optional />
            <MappingSelect header={analysis.header} name="col_purpose" label="Spalte Verwendungszweck" value={analysis.mapping.purpose} />
            <MappingSelect header={analysis.header} name="col_counterparty" label="Spalte Zahlungspartner (optional)" value={analysis.mapping.counterparty} optional />
            <button type="submit" className={buttonSecondaryClass} disabled={analyzing}>
              Vorschau aktualisieren
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            {analysis.mappingQuelle === "gespeichert"
              ? "Spalten aus der zuletzt bestätigten Zuordnung dieses Kontos."
              : analysis.mappingQuelle === "manuell"
                ? "Spalten von Hand gesetzt."
                : "Spalten automatisch erkannt."}{" "}
            Entweder eine Betragsspalte oder Soll und Haben — nicht beides.
          </p>

          {mappingReady ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1.5 pr-3">Datum</th>
                      <th className="py-1.5 pr-3">Art</th>
                      <th className="py-1.5 pr-3">Betrag</th>
                      <th className="py-1.5 pr-3">Text</th>
                      <th className="py-1.5 pr-3">Vorschlag</th>
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
                        <td className="py-1.5 pr-3">
                          {row.vorschlag ? <VorschlagZelle vorschlag={row.vorschlag} /> : "—"}
                        </td>
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

              <form action={importCsvAction} className="mt-4 grid gap-3">
                <input type="hidden" name="propertyId" value={propertyId} />
                <input type="hidden" name="accountId" value={analysis.accountId} />
                <input type="hidden" name="contentBase64" value={analysis.contentBase64} />
                <input type="hidden" name="fileName" value={analysis.fileName} />
                <input type="hidden" name="encoding" value={analysis.diagnose.encoding} />
                <input type="hidden" name="col_date" value={analysis.mapping.date} />
                <input type="hidden" name="col_purpose" value={analysis.mapping.purpose} />
                {analysis.mapping.amount !== undefined ? (
                  <input type="hidden" name="col_amount" value={analysis.mapping.amount} />
                ) : null}
                {analysis.mapping.debit !== undefined ? (
                  <input type="hidden" name="col_debit" value={analysis.mapping.debit} />
                ) : null}
                {analysis.mapping.credit !== undefined ? (
                  <input type="hidden" name="col_credit" value={analysis.mapping.credit} />
                ) : null}
                {analysis.mapping.counterparty !== undefined ? (
                  <input type="hidden" name="col_counterparty" value={analysis.mapping.counterparty} />
                ) : null}

                {/* KI-Vorschläge reisen zurück, weil sie sich nicht
                    wiederholbar nachrechnen lassen; der Server prüft, dass die
                    Kostenart zu diesem Objekt gehört. */}
                {analysis.preview
                  .filter((r) => r.vorschlag?.ki && r.vorschlag.costTypeId)
                  .map((r) => (
                    <input
                      key={r.hash}
                      type="hidden"
                      name="ki"
                      value={`${r.hash}|${r.vorschlag?.costTypeId}`}
                    />
                  ))}

                <VorschlagsBestaetigung vorschlaege={analysis.vorschlaege} />

                <div>
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={analysis.parseable - analysis.duplicates <= 0}
                  >
                    {analysis.parseable - analysis.duplicates} Buchung(en) importieren
                  </button>
                </div>
              </form>
            </>
          ) : (
            <p className="mt-3 text-sm text-amber-700">
              Die Spalten für Buchungstag, Betrag und Verwendungszweck konnten nicht
              automatisch erkannt werden — bitte oben zuordnen und „Vorschau
              aktualisieren“ wählen. Was gelesen wurde, steht darüber.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Was beim Lesen erkannt wurde — immer sichtbar, nicht nur im Fehlerfall. */
function Diagnose({ diagnose, className = "" }: { diagnose: ImportDiagnose; className?: string }) {
  return (
    <div className={`rounded-xl bg-gray-50 p-3 text-xs text-gray-600 ${className}`}>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Zeichensatz: <strong>{ZEICHENSATZ_TEXT[diagnose.encoding] ?? diagnose.encoding}</strong>
        </span>
        <span>
          Trennzeichen: <strong>{TRENNZEICHEN_TEXT[diagnose.delimiter] ?? diagnose.delimiter}</strong>
        </span>
        <span>
          Kopfzeile vorhanden: <strong>{diagnose.hasHeader ? "ja" : "nein"}</strong>
          {diagnose.hasHeader && diagnose.skippedBefore > 0
            ? ` (${diagnose.skippedBefore} Zeile(n) davor übersprungen)`
            : ""}
        </span>
      </div>
      {diagnose.rawLines.length > 0 ? (
        <div className="mt-2">
          <span className="text-gray-500">Erste Zeilen der Datei:</span>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-white p-2 font-mono text-[11px] leading-relaxed text-gray-700">
            {diagnose.rawLines.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function VorschlagZelle({ vorschlag }: { vorschlag: ImportVorschlag }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span title={vorschlag.grund}>{truncate(vorschlag.label, 28)}</span>
      <Badge tone={GUETE_TON[vorschlag.guete]}>{vorschlag.guete}</Badge>
      {/* KI-Ausgaben werden als solche gekennzeichnet (Art. 50 KI-VO). */}
      {vorschlag.ki ? <Badge tone="info">KI</Badge> : null}
    </span>
  );
}

/**
 * Bestätigung der Vorschläge — je Gütegrad ein Häkchen.
 *
 * Vorbelegt ist nur „sicher"; alles andere setzt der Verwalter selbst. Nichts
 * wird still gebucht: Ohne Häkchen kommen die Buchungen ohne Zuordnung herein,
 * genau wie bisher.
 */
function VorschlagsBestaetigung({ vorschlaege }: { vorschlaege: Record<Guete, number> }) {
  const gesamt = vorschlaege.sicher + vorschlaege.wahrscheinlich + vorschlaege.unsicher;
  if (gesamt === 0) return null;
  const stufen: { guete: Guete; label: string }[] = [
    { guete: "sicher", label: "sichere" },
    { guete: "wahrscheinlich", label: "wahrscheinliche" },
    { guete: "unsicher", label: "unsichere" },
  ];
  return (
    <fieldset className="rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">
        Zuordnungsvorschläge übernehmen
      </legend>
      <p className="text-xs text-gray-500">
        Einnahmen bekommen eine Einheit, Ausgaben eine Kostenart. Angerechnet wird nichts —
        auf welche Forderung eine Zahlung tilgt, entscheiden Sie im Hausgeld.
      </p>
      <div className="mt-2 flex flex-wrap gap-4">
        {stufen.map(({ guete, label }) => (
          <label
            key={guete}
            className={`flex items-center gap-2 text-sm ${vorschlaege[guete] === 0 ? "text-gray-400" : "text-gray-800"}`}
          >
            <input
              type="checkbox"
              name="uebernehmen"
              value={guete}
              defaultChecked={guete === "sicher"}
              disabled={vorschlaege[guete] === 0}
              className="h-4 w-4 rounded border-gray-300"
            />
            {vorschlaege[guete]} {label}
          </label>
        ))}
      </div>
    </fieldset>
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
