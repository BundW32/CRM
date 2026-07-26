import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Card } from "@/components/ui";
import type { SetupStatus, SetupStep } from "@/lib/weg/setup-status";
import { markSetupStep } from "./setup-actions";

/**
 * Der geführte Erststart einer selbstverwalteten WEG.
 *
 * Bisher landete eine frisch registrierte Gemeinschaft auf einer leeren Seite
 * mit einem Satz Bedienungsanleitung. Die Reihenfolge der Einrichtung ist aber
 * fachlich zwingend – wer sie nicht kennt, läuft in Fehlermeldungen.
 *
 * Deshalb: genau EIN hervorgehobener nächster Schritt, darunter die ganze Kette
 * zum Mitlesen. Jeder Schritt sagt, wozu er gut ist – nicht nur, dass er fehlt.
 */
export function SetupGuide({ status, isAdmin }: { status: SetupStatus; isAdmin: boolean }) {
  const { steps, erledigt, gesamt, naechster } = status;
  const prozent = Math.round((erledigt / gesamt) * 100);

  return (
    <>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Ihre WEG einrichten</h2>
          <p className="text-sm text-gray-500">
            {erledigt} von {gesamt} Schritten
          </p>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
          role="progressbar"
          aria-valuenow={erledigt}
          aria-valuemin={0}
          aria-valuemax={gesamt}
          aria-label="Fortschritt der Einrichtung"
        >
          <div
            className="h-full rounded-full bg-brand-orange transition-all"
            style={{ width: `${prozent}%` }}
          />
        </div>

        {naechster ? (
          <div className="mt-4 rounded-xl border border-brand-orange/30 bg-brand-orange-light p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-orange-dark">
              Als Nächstes
            </p>
            <p className="mt-1 text-base font-semibold text-gray-900">{naechster.title}</p>
            <p className="mt-1 text-sm text-gray-700">{naechster.why}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {naechster.href ? (
                <Link
                  href={naechster.href}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-orange px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-orange-dark"
                >
                  Jetzt erledigen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              {naechster.manual && isAdmin ? (
                <AbhakenButton stepKey={naechster.key} propertyId={status.propertyId} />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <Card title="Alle Schritte">
        <ol className="space-y-1">
          {steps.map((s) => (
            <SchrittZeile
              key={s.key}
              step={s}
              aktiv={naechster?.key === s.key}
              isAdmin={isAdmin}
              propertyId={status.propertyId}
            />
          ))}
        </ol>
        <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
          Die Reihenfolge ist nicht willkürlich: Jeder Schritt braucht den vorherigen. Ohne
          Kostenarten lässt sich kein Wirtschaftsplan aufstellen, ohne beschlossenen Plan
          entstehen keine Hausgeld-Forderungen.
        </p>
      </Card>
    </>
  );
}

function SchrittZeile({
  step,
  aktiv,
  isAdmin,
  propertyId,
}: {
  step: SetupStep;
  aktiv: boolean;
  isAdmin: boolean;
  propertyId: string | null;
}) {
  const inhalt = (
    <>
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          step.done
            ? "border-good bg-good-light text-good"
            : aktiv
              ? "border-brand-orange bg-brand-orange text-white"
              : "border-gray-300 text-gray-400"
        }`}
      >
        {step.done ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm ${
            step.done ? "text-gray-400 line-through" : "font-medium text-gray-900"
          }`}
        >
          {step.title}
        </span>
        {!step.done ? <span className="block text-xs text-gray-500">{step.why}</span> : null}
        {step.warnung ? (
          <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {step.warnung}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <li className="border-b border-gray-50 py-2 last:border-0">
      <div className="flex items-start gap-3">
        {step.href && !step.done ? (
          <Link href={step.href} className="flex flex-1 items-start gap-3 hover:opacity-80">
            {inhalt}
          </Link>
        ) : (
          inhalt
        )}
        {step.manual && !step.done && isAdmin ? (
          <AbhakenButton stepKey={step.key} propertyId={propertyId} klein />
        ) : null}
      </div>
    </li>
  );
}

function AbhakenButton({
  stepKey,
  propertyId,
  klein = false,
}: {
  stepKey: string;
  propertyId: string | null;
  klein?: boolean;
}) {
  // Ohne Objekt gibt es nichts zu vermerken – der Schritt hängt am Objekt.
  if (!propertyId) return null;
  return (
    <form action={markSetupStep}>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="key" value={stepKey} />
      <button
        type="submit"
        className={
          klein
            ? "shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            : "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        }
      >
        Erledigt
      </button>
    </form>
  );
}
