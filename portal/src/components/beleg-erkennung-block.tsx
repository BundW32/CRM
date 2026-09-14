"use client";

// Beleg wählen → Felder vorschlagen. Ein Block für zwei Formulare:
// „Verbindlichkeit erfassen" (offene Rechnung) und „Buchung erfassen"
// (Zahlung). Beide brauchen dieselben Werte aus derselben Rechnung — Betrag,
// Rechnungssteller, Nummer, Leistung, Lohnanteil § 35a — und denselben Weg
// dorthin. Vorher stand das alles nur im Verbindlichkeiten-Formular; ein
// Testnutzer hat die Erkennung dort gesucht, wo er die Rechnung bezahlt.
//
// Zwei Wege, sichtbar getrennt: Der lokale (E-Rechnung, Text-PDF) ist immer
// da und schickt nichts nach außen. Der KI-Weg über Google erscheint nur,
// wenn er freigeschaltet ist UND der lokale Weg an dieser Datei gescheitert
// ist (Scan, Foto) — und läuft erst, nachdem die Verwaltung in einem Dialog
// ausdrücklich zugestimmt hat. Der Server prüft die Zustimmung noch einmal.
//
// Die Erkennung läuft beim Auswählen der Datei von selbst — ein zweiter Knopf
// wäre ein Schritt, den niemand braucht.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileInput } from "@/components/file-input";
import {
  erkenneBeleg,
  type BelegErkennungResult,
  type BelegVorschlag,
} from "@/app/(portal)/verwaltung/weg/[propertyId]/verbindlichkeiten/import-actions";

export type BelegQuelle = Extract<BelegErkennungResult, { ok: true }>["quelle"];

export function BelegErkennungBlock({
  propertyId,
  kiErkennung,
  titel,
  hinweis,
  name,
  onErkannt,
  fehlt,
}: {
  propertyId: string;
  /** Ist die KI-Erkennung über Google freigeschaltet? Sonst gibt es nur den lokalen Weg. */
  kiErkennung: boolean;
  titel: string;
  /** Der Satz unter dem Titel — sagt, was mit der Datei geschieht (abgelegt oder nicht). */
  hinweis: string;
  /**
   * Trägt das Dateifeld einen Namen, geht die Datei beim Absenden mit
   * (Buchung: der Beleg wird gespeichert). Ohne Namen bleibt sie im Browser.
   */
  name?: string;
  onErkannt: (daten: BelegVorschlag, quelle: BelegQuelle) => void;
  /** Welche Felder in diesem Formular als „nicht erkannt" zu nennen sind. */
  fehlt: (daten: BelegVorschlag) => string[];
}) {
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
      onErkannt(res.data, res.quelle);
      const offen = fehlt(res.data);
      const quelle =
        res.quelle === "e-rechnung"
          ? "aus der E-Rechnung (XML) gelesen"
          : res.quelle === "text"
            ? "aus dem Text der PDF gelesen"
            : "von der KI vorgeschlagen";
      setMeldung({
        ok: true,
        text:
          offen.length > 0
            ? `Werte ${quelle} — nicht erkannt: ${offen.join(", ")}. Bitte prüfen und ergänzen.`
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
    <div className="rounded-2xl border border-brand-orange/30 bg-brand-orange-light/50 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-green">{titel}</p>
          <p className="mt-0.5 text-xs text-gray-600">{hinweis}</p>
        </div>
        <FileInput
          inputRef={belegRef}
          name={name}
          accept={
            kiErkennung
              ? "application/pdf,application/xml,text/xml,.xml,image/jpeg,image/png,image/webp"
              : name
                ? // Als Beleg der Buchung darf auch ein Foto mit — gelesen wird es
                  // ohne KI nicht, gespeichert schon.
                  "application/pdf,application/xml,text/xml,.xml,image/*"
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
                Sie erhalten die Werte als Vorschlag und prüfen sie, bevor Sie speichern.
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
  );
}
