"use client";

// Rechnungsimport in zwei Schritten: Datei prüfen → Vorschau → anlegen.
//
// Die Vorschau ist der Kern. Wer eine Datei hochlädt, will vorher sehen, was
// passiert — und nicht hinterher zählen, was fehlt. Jede Zeile trägt ihren
// Status: wird angelegt, schon erfasst (übersprungen) oder unlesbar mit dem
// Grund. Eine unlesbare Zeile hält die anderen nicht auf; sie steht sichtbar
// da und lässt sich in der Datei nachbessern.
import { useActionState } from "react";
import { Badge, DataTable, type Column } from "@/components/data-display";
import { FileInput } from "@/components/file-input";
import { PendingButton } from "@/components/pending-button";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { formatCents } from "@/lib/money";
import { importiereRechnungenAction, pruefeRechnungenAction, type ImportVorschau, type VorschauZeile } from "./actions";

function datum(iso: string | null): string {
  if (!iso) return "—";
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

const STATUS: Record<VorschauZeile["status"], { text: string; tone: "success" | "neutral" | "danger" }> = {
  neu: { text: "wird angelegt", tone: "success" },
  vorhanden: { text: "schon erfasst", tone: "neutral" },
  fehler: { text: "unlesbar", tone: "danger" },
};

export function RechnungenImportClient({ propertyId }: { propertyId: string }) {
  const [vorschau, pruefen, prueft] = useActionState<ImportVorschau | null, FormData>(
    pruefeRechnungenAction,
    null,
  );

  const spalten: Column<VorschauZeile>[] = [
    { header: "Zeile", cell: (z) => <span className="text-gray-400">{z.zeile}</span>, className: "w-px" },
    {
      header: "Bezeichnung",
      cell: (z) => (
        <div>
          <div className={z.status === "fehler" ? "text-gray-500" : "font-medium text-gray-900"}>{z.title}</div>
          {z.creditor ? <div className="text-xs text-gray-500">{z.creditor}</div> : null}
          {z.hinweis ? (
            <div className={`text-xs ${z.status === "fehler" ? "text-critical" : "text-gray-500"}`}>{z.hinweis}</div>
          ) : null}
        </div>
      ),
    },
    { header: "Betrag", align: "right", cell: (z) => (z.amountCents != null ? formatCents(z.amountCents) : "—") },
    { header: "Rechnungsdatum", cell: (z) => datum(z.incurredOn) },
    { header: "Fällig", cell: (z) => datum(z.dueDate) },
    { header: "Status", cell: (z) => <Badge tone={STATUS[z.status].tone}>{STATUS[z.status].text}</Badge> },
  ];

  return (
    <div className="grid gap-4">
      <form action={pruefen} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="propertyId" value={propertyId} />
        <FileInput name="file" accept=".csv,text/csv,text/plain" required label="CSV-Datei wählen" />
        <PendingButton className={buttonClass} pendingLabel="Wird geprüft…" disabled={prueft}>
          Datei prüfen
        </PendingButton>
      </form>

      {vorschau && !vorschau.ok ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{vorschau.error}</p>
      ) : null}

      {vorschau?.ok ? (
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {vorschau.fileName} · {vorschau.zeilen.length} Zeile{vorschau.zeilen.length === 1 ? "" : "n"}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            <strong className="text-good">{vorschau.neu}</strong> {vorschau.neu === 1 ? "wird" : "werden"} als offene Rechnung angelegt
            {vorschau.vorhanden > 0 ? (
              <>
                , <strong>{vorschau.vorhanden}</strong> {vorschau.vorhanden === 1 ? "ist" : "sind"} schon erfasst und{" "}
                {vorschau.vorhanden === 1 ? "wird" : "werden"} übersprungen
              </>
            ) : null}
            {vorschau.fehler > 0 ? (
              <>
                , <strong className="text-critical">{vorschau.fehler}</strong> {vorschau.fehler === 1 ? "ist" : "sind"} unlesbar
                und {vorschau.fehler === 1 ? "bleibt" : "bleiben"} außen vor
              </>
            ) : null}
            .
          </p>

          <div className="mt-3">
            <DataTable columns={spalten} rows={vorschau.zeilen} getKey={(z) => String(z.zeile)} minWidth="44rem" caption="Vorschau des Rechnungsimports" />
          </div>

          <form action={importiereRechnungenAction} className="mt-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="contentBase64" value={vorschau.contentBase64} />
            <input type="hidden" name="fileName" value={vorschau.fileName} />
            <PendingButton className={buttonClass} pendingLabel="Wird angelegt…" disabled={vorschau.neu === 0}>
              {vorschau.neu === 0
                ? "Nichts anzulegen"
                : `${vorschau.neu} Rechnung${vorschau.neu === 1 ? "" : "en"} anlegen`}
            </PendingButton>
            {vorschau.fehler > 0 ? (
              <span className="text-xs text-gray-500">
                Unlesbare Zeilen in der Datei korrigieren und erneut prüfen — oder ohne sie anlegen.
              </span>
            ) : null}
          </form>
        </div>
      ) : null}

      {!vorschau ? (
        <p className="text-xs text-gray-500">
          Noch keine Datei? Die{" "}
          <a href={`/verwaltung/weg/${propertyId}/verbindlichkeiten/import/vorlage`} className={`${buttonSecondaryClass} !px-2 !py-0.5 !text-xs`}>
            Vorlage herunterladen
          </a>{" "}
          — in Excel ausfüllen, als CSV speichern, hochladen.
        </p>
      ) : null}
    </div>
  );
}
