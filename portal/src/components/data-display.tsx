// Anzeige-Bausteine: Etikett, Tabelle, Kennzahl.
//
// Anlass: 61 von Hand geschriebene Etiketten, 26 Tabellen mit jeweils leicht
// abweichenden Kopfzeilen und Abständen, dazu Kennzahlen in drei Größen. Sichtbar
// wurde es zuerst auf „Beschlüsse": Die Abstimmungszahlen standen dort als Fließtext,
// weil es keinen Baustein gab, der sie als Zahlen zeigt.
//
// Alles rendert serverseitig, kein Client-JS.

import type { ReactNode } from "react";

// ── Abstände ────────────────────────────────────────────────────────────────
// Vorher acht verschiedene Stufen zwischen Blöcken (space-y-2 bis space-y-8).
// Drei genügen, und mit Namen versehen wählt man sie nach Bedeutung statt nach Gefühl.
/** Dicht: Zeilen einer Aufzählung, Felder eines Formulars. */
export const stackTight = "space-y-3";
/** Normal: Blöcke innerhalb einer Karte. */
export const stack = "space-y-4";
/** Weit: Karten und Abschnitte einer Seite. */
export const stackLoose = "space-y-6";

// ── Etikett ─────────────────────────────────────────────────────────────────

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  success: "bg-good-light text-good",
  warning: "bg-warn-light text-warn",
  danger: "bg-critical-light text-critical",
  info: "bg-blue-50 text-blue-700",
  accent: "bg-brand-orange-light text-brand-orange-ink",
};

/**
 * Kurzes Statuszeichen an einer Zeile oder Überschrift.
 *
 * Die Töne sind **semantisch** gewählt, nicht farblich: „danger" heißt „hier stimmt
 * etwas nicht", nicht „rot". Wer eine Farbe direkt setzen möchte, sucht meist einen
 * fehlenden Ton – dann gehört er hierher, damit er überall gleich aussieht.
 *
 * `dot` setzt einen Punkt davor, für Zustände, die man in einer langen Liste
 * schnell überfliegen will.
 */
export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badgeTones[tone]} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

// ── Tabelle ─────────────────────────────────────────────────────────────────

export type Column<T> = {
  /** Spaltenüberschrift; leer lassen für Aktionsspalten. */
  header?: ReactNode;
  /** Inhalt der Zelle. */
  cell: (row: T, index: number) => ReactNode;
  /** Zahlen gehören nach rechts – dann fluchten die Stellen untereinander. */
  align?: "left" | "right" | "center";
  /** Zusätzliche Klassen für die Zelle (z. B. `w-px` für Aktionsspalten). */
  className?: string;
};

/**
 * Tabelle für Listen – eine Form für alle.
 *
 * Waagerecht scrollt der Kasten, nicht die Seite: `minWidth` gibt an, ab welcher
 * Breite die Tabelle lesbar bleibt; darunter erscheint ein eigener Scrollbereich.
 * Ohne diesen Deckel schoben schmale Bildschirme bisher die ganze Seite zur Seite.
 *
 * `empty` ersetzt die Tabelle vollständig, wenn es nichts zu zeigen gibt – eine
 * Kopfzeile über einer leeren Fläche sieht nach Fehler aus.
 *
 * **Die entscheidende Spalte gehört nach vorn.** Auf einem Telefon sieht man nur die
 * ersten beiden Spalten, der Rest liegt hinter dem Scroll. Steht dort etwas
 * Nebensächliches, muss man für jede Zeile schieben. Auf „Wartung" stand zuerst das
 * Intervall vor der Fälligkeit – also alles außer dem, weshalb man die Seite öffnet.
 */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty,
  minWidth = "36rem",
  caption,
}: {
  columns: readonly Column<T>[];
  rows: readonly T[];
  getKey: (row: T, index: number) => string;
  empty?: ReactNode;
  /** CSS-Breite, unterhalb derer der Kasten scrollt. */
  minWidth?: string;
  /** Für Screenreader: was steht in dieser Tabelle? */
  caption?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  const alignOf = (a: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
  const hasHeader = columns.some((c) => c.header);

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm" style={{ minWidth }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {hasHeader ? (
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((c, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`px-3 py-2 text-xs font-semibold tracking-wide text-gray-500 uppercase ${alignOf(c.align)} ${c.className ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getKey(row, index)}
              className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
            >
              {columns.map((c, i) => (
                <td
                  key={i}
                  className={`px-3 py-2.5 text-gray-700 align-middle ${alignOf(c.align)} ${c.className ?? ""}`}
                >
                  {c.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Kennzahl ────────────────────────────────────────────────────────────────

/**
 * Eine einzelne Zahl mit Beschriftung – Kontostand, Rücklage, Stimmenzahl.
 *
 * Zahlen laufen in `tabular-nums` (steht global auf `body`), damit mehrere
 * Kennzahlen nebeneinander an derselben Stelle brechen. `tone` färbt nur die Zahl,
 * nicht die Beschriftung: Ein negativer Kontostand soll auffallen, sein Etikett nicht.
 */
export function KeyFigure({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: ReactNode;
  value: ReactNode;
  /** Einordnende Kleinigkeit unter der Zahl (Stichtag, Vergleich). */
  hint?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "critical";
}) {
  const color =
    tone === "good"
      ? "text-good"
      : tone === "warn"
        ? "text-warn"
        : tone === "critical"
          ? "text-critical"
          : "text-gray-900";
  return (
    <div>
      <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

/**
 * Kennzahlen für eine **Kopfzeile** – Zahl und Beschriftung nebeneinander statt
 * untereinander.
 *
 * Gedacht für eingeklappte Karten: Dort steht in der Mitte ohnehin freie Fläche,
 * und drei farbige Zahlen sagen dort mehr als eine graue Textzeile. Bewusst kleiner
 * als `KeyFigure` – die Kopfzeile soll überflogen, nicht studiert werden.
 */
export function InlineFigures({
  items,
}: {
  items: readonly { label: string; value: ReactNode; tone?: "neutral" | "good" | "warn" | "critical" }[];
}) {
  const color = (t?: string) =>
    t === "good"
      ? "text-good"
      : t === "warn"
        ? "text-warn"
        : t === "critical"
          ? "text-critical"
          : "text-gray-900";
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className={`text-lg font-semibold ${color(it.tone)}`}>{it.value}</span>
          <span className="text-xs font-normal text-gray-500">{it.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Reihe aus Kennzahlen – bricht auf Mobil in zwei Spalten statt zu quetschen.
 */
export function KeyFigures({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}
