// Das Handbuch: Kapitel als Markdown-Dateien unter `src/content/hilfe`.
//
// Kein CMS, kein Drittdienst — die Kapitel liegen im Repository neben dem
// Code, den sie beschreiben, und ändern sich im selben Commit. Gelesen werden
// sie zur Laufzeit von der Platte; `next.config.ts` nimmt den Ordner in die
// Ablauf-Verfolgung auf (wie die Schriften der PDF-Erzeugung), sonst fehlten
// die Dateien im Serverless-Bundle.
//
// Jede Datei beginnt mit einem Kopf zwischen zwei `---`-Zeilen:
//
//   titel: Rechnungen und Belege
//   kurz: Drei Wege, wie eine Rechnung ins Buch kommt.
//   bereich: finanzen
//   reihenfolge: 30
//   rollen: verwalter
//   nur: selbstverwaltung        (optional: selbstverwaltung | professionell)
//
// `rollen` und `nur` steuern nur, welche Kapitel die Übersicht einer Person
// zeigt. Ein direkter Link führt immer zum Kapitel — das Handbuch enthält
// keine Geheimnisse, nur Erklärungen; und ein Eigentümer, dem der Verwalter
// einen Link schickt, soll ihn öffnen können.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import type { Role } from "@/generated/prisma/client";
import { gliederung, leseMarkdown, type Block } from "./markdown";

export const BEREICHE = [
  { key: "start", titel: "Erste Schritte" },
  { key: "alltag", titel: "Alltag" },
  { key: "gemeinschaft", titel: "Gemeinschaft" },
  { key: "finanzen", titel: "Finanzen" },
  { key: "betrieb", titel: "Betrieb" },
  { key: "konto", titel: "Konto und Einstellungen" },
] as const;
export type Bereich = (typeof BEREICHE)[number]["key"];

export type HandbuchRolle = "verwalter" | "eigentuemer" | "mieter";
export type Verwaltungsart = "selbstverwaltung" | "professionell";

export type Kapitel = {
  slug: string;
  titel: string;
  kurz: string;
  bereich: Bereich;
  reihenfolge: number;
  rollen: HandbuchRolle[];
  nur: Verwaltungsart | null;
  markdown: string;
};

export type Leser = {
  role: Role;
  selfManaged: boolean;
};

const ORDNER = join(process.cwd(), "src", "content", "hilfe");

function istBereich(wert: string): wert is Bereich {
  return BEREICHE.some((b) => b.key === wert);
}

/** Kopfdaten und Text einer Kapiteldatei. Fehlende Pflichtangaben sind ein Fehler
 *  beim Bauen, nicht eine leere Karte in der Produktion. */
export function leseKapitelDatei(slug: string, quelle: string): Kapitel {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(quelle.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`Handbuch-Kapitel „${slug}": Kopf zwischen --- fehlt`);
  const kopf: Record<string, string> = {};
  for (const zeile of m[1].split("\n")) {
    const kv = /^([a-z]+):\s*(.*)$/.exec(zeile.trim());
    if (kv) kopf[kv[1]] = kv[2].trim();
  }
  const titel = kopf.titel;
  const bereich = kopf.bereich ?? "";
  if (!titel) throw new Error(`Handbuch-Kapitel „${slug}": titel fehlt`);
  if (!istBereich(bereich)) throw new Error(`Handbuch-Kapitel „${slug}": bereich „${bereich}" unbekannt`);
  const rollen = (kopf.rollen ?? "verwalter, eigentuemer, mieter")
    .split(",")
    .map((r) => r.trim())
    .filter((r): r is HandbuchRolle => r === "verwalter" || r === "eigentuemer" || r === "mieter");
  if (rollen.length === 0) throw new Error(`Handbuch-Kapitel „${slug}": rollen leer`);
  const nur = kopf.nur === "selbstverwaltung" || kopf.nur === "professionell" ? kopf.nur : null;
  return {
    slug,
    titel,
    kurz: kopf.kurz ?? "",
    bereich,
    reihenfolge: Number(kopf.reihenfolge ?? 999),
    rollen,
    nur,
    markdown: m[2].trim(),
  };
}

/** Alle Kapitel, nach Bereich und Reihenfolge sortiert. Pro Request gecacht. */
export const alleKapitel = cache((): Kapitel[] => {
  const dateien = readdirSync(ORDNER).filter((f) => f.endsWith(".md")).sort();
  const kapitel = dateien.map((f) =>
    leseKapitelDatei(f.replace(/\.md$/, ""), readFileSync(join(ORDNER, f), "utf8")),
  );
  const rang = (b: Bereich) => BEREICHE.findIndex((x) => x.key === b);
  return kapitel.sort(
    (a, b) => rang(a.bereich) - rang(b.bereich) || a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel, "de"),
  );
});

export function kapitelNachSlug(slug: string): Kapitel | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return alleKapitel().find((k) => k.slug === slug) ?? null;
}

function rolleVon(role: Role): HandbuchRolle | null {
  if (role === "VERWALTER") return "verwalter";
  if (role === "EIGENTUEMER") return "eigentuemer";
  if (role === "MIETER") return "mieter";
  return null;
}

/** Passt ein Kapitel zur lesenden Person? (Nur für die Übersicht.) */
export function passtZu(kapitel: Kapitel, leser: Leser): boolean {
  const rolle = rolleVon(leser.role);
  if (!rolle || !kapitel.rollen.includes(rolle)) return false;
  if (kapitel.nur === "selbstverwaltung" && !leser.selfManaged) return false;
  if (kapitel.nur === "professionell" && leser.selfManaged) return false;
  return true;
}

export function kapitelFuer(leser: Leser): Kapitel[] {
  return alleKapitel().filter((k) => passtZu(k, leser));
}

/** Gelesener Inhalt eines Kapitels samt Gliederung. */
export function kapitelInhalt(kapitel: Kapitel): { bloecke: Block[]; gliederung: ReturnType<typeof gliederung> } {
  const bloecke = leseMarkdown(kapitel.markdown);
  return { bloecke, gliederung: gliederung(bloecke) };
}
