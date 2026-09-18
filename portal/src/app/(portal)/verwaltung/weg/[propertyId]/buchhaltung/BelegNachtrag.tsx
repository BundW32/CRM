"use client";

// Beleg an eine vorhandene Buchung hängen — direkt in der Zeile.
//
// Der Normalfall dafür ist die importierte Buchung: Der Kontoauszug bringt den
// Umsatz, die Rechnung kommt getrennt. Bisher gab es das Dateifeld nur beim
// Erfassen von Hand; danach war der Beleg nicht mehr anzubringen.
//
// Beim Auswählen liest das Portal die Datei wie im Buchungsformular (lokal,
// ohne Drittdienst) — nicht um Felder zu füllen, sondern um zu **vergleichen**:
// Weicht der Rechnungsbetrag vom gebuchten ab, sagt die Zeile das, bevor der
// Beleg an der falschen Buchung landet. Angehängt wird trotzdem, wenn man will
// — Teilzahlungen und Skonto sind keine Fehler. Ein erkannter Lohnanteil § 35a
// wird als Übernahme angeboten, wenn die Buchung noch keinen hat.
import { useRef, useState } from "react";
import { FileInput } from "@/components/file-input";
import { PendingButton } from "@/components/pending-button";
import { buttonSecondaryClass } from "@/components/ui";
import { erkenneBeleg } from "@/app/(portal)/verwaltung/weg/[propertyId]/verbindlichkeiten/import-actions";
import { attachBeleg } from "./actions";

/** „1.250,00" → 125000; null, wenn nicht lesbar. Nur für den Vergleich im Browser. */
function centsAus(deutsch: string): number | null {
  const s = deutsch.replace(/\./g, "").replace(",", ".").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const euro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export function BelegNachtrag({
  propertyId,
  bookingId,
  amountCents,
  bookingDateIso,
  text,
  hatBeleg,
  lohnanteilOffen,
}: {
  propertyId: string;
  bookingId: string;
  amountCents: number;
  /** YYYY-MM-DD des Buchungstags. */
  bookingDateIso: string;
  text: string;
  /** Es hängt schon ein Beleg — dann heißt der Weg „ersetzen" und fragt nach. */
  hatBeleg: boolean;
  /** Ausgabe auf einer § 35a-Kostenart ohne erfassten Lohnanteil. */
  lohnanteilOffen: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const [liest, setLiest] = useState(false);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [lohnanteil, setLohnanteil] = useState<string | null>(null);
  const [lohnanteilUebernehmen, setLohnanteilUebernehmen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function vergleichen(file: File) {
    setHinweise([]);
    setLohnanteil(null);
    // Fotos liest der lokale Weg nicht — dann gibt es nichts zu vergleichen,
    // und das ist kein Fehler: Angehängt wird die Datei so oder so.
    if (!/pdf|xml/.test(file.type)) return;
    setLiest(true);
    try {
      const fd = new FormData();
      fd.append("propertyId", propertyId);
      fd.append("beleg", file);
      fd.append("weg", "lokal");
      const res = await erkenneBeleg(fd);
      if (!res.ok) return;
      const neu: string[] = [];
      const rechnung = res.data.amount ? centsAus(res.data.amount) : null;
      if (rechnung != null && rechnung !== amountCents) {
        neu.push(
          `Die Rechnung lautet über ${euro(rechnung)}, gebucht sind ${euro(amountCents)}. Teilzahlung oder Skonto? Sonst gehört der Beleg vielleicht zu einer anderen Buchung.`,
        );
      }
      if (res.data.incurredOn && res.data.incurredOn > bookingDateIso) {
        neu.push(
          `Das Rechnungsdatum (${res.data.incurredOn.split("-").reverse().join(".")}) liegt nach dem Buchungstag.`,
        );
      }
      setHinweise(neu);
      if (lohnanteilOffen && res.data.labor) setLohnanteil(res.data.labor);
    } catch {
      // Vergleich ist Komfort, kein Muss.
    } finally {
      setLiest(false);
    }
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={hatBeleg ? "text-xs text-gray-400 underline" : "text-xs text-brand-green underline"}
      >
        {hatBeleg ? "ersetzen" : "Beleg anhängen"}
      </button>
    );
  }

  return (
    <form action={attachBeleg} className="min-w-[16rem] space-y-2 rounded-xl border border-gray-200 bg-white p-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      {hatBeleg ? <input type="hidden" name="ersetzen" value="ja" /> : null}
      <FileInput
        inputRef={fileRef}
        name="beleg"
        required
        accept="application/pdf,application/xml,text/xml,.xml,image/*"
        label={hatBeleg ? "Neuen Beleg wählen" : "Datei wählen"}
        onFilesChange={(files) => {
          const f = files?.[0];
          if (f) void vergleichen(f);
          else {
            setHinweise([]);
            setLohnanteil(null);
          }
        }}
      />
      {liest ? <p className="text-xs text-gray-500">Rechnung wird gelesen…</p> : null}
      {hinweise.map((h) => (
        <p key={h} className="text-xs text-amber-700">
          {h}
        </p>
      ))}
      {lohnanteil ? (
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={lohnanteilUebernehmen}
            onChange={(e) => setLohnanteilUebernehmen(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-gray-900"
          />
          <span>
            Lohnanteil § 35a aus der Rechnung übernehmen: <strong>{lohnanteil} €</strong>
          </span>
          {lohnanteilUebernehmen ? <input type="hidden" name="laborShare" value={lohnanteil} /> : null}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <PendingButton className={`${buttonSecondaryClass} text-xs`} pendingLabel="Wird angehängt…">
          {hatBeleg ? "Ersetzen" : "Anhängen"}
        </PendingButton>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="text-xs text-gray-500 underline"
          aria-label={`Beleg für ${text} nicht anhängen`}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
