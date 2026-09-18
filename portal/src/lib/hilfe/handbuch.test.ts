import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEREICHE, leseKapitelDatei, passtZu } from "./handbuch";
import { leseMarkdown, type Block, type Inline } from "./markdown";

// Ein Handbuch, das auf Seiten verweist, die es nicht gibt, ist schlimmer als
// keines: Der Leser klickt, landet im Nichts und traut danach auch dem Rest
// nicht mehr. Deshalb hier die Gegenprobe gegen den Quelltext: Jeder interne
// Link eines Kapitels muss auf eine Seite des Portals oder ein anderes
// Kapitel zeigen.

const wurzel = join(__dirname, "..", "..", "..");
const ordner = join(wurzel, "src", "content", "hilfe");
const dateien = readdirSync(ordner).filter((f) => f.endsWith(".md")).sort();
const kapitel = dateien.map((f) =>
  leseKapitelDatei(f.replace(/\.md$/, ""), readFileSync(join(ordner, f), "utf8")),
);

function alleLinks(bloecke: Block[]): string[] {
  const gefunden: string[] = [];
  const geheInline = (kinder: Inline[]) => {
    for (const k of kinder) {
      if (k.art === "link") gefunden.push(k.href);
      if ("kinder" in k) geheInline(k.kinder);
    }
  };
  for (const b of bloecke) {
    if (b.art === "liste") b.punkte.forEach(geheInline);
    else if (b.art === "tabelle") {
      b.kopf.forEach(geheInline);
      b.zeilen.forEach((z) => z.forEach(geheInline));
    } else if (b.art !== "linie") geheInline(b.kinder);
  }
  return gefunden;
}

/** Gibt es zu einem Portal-Pfad eine Seite? Dynamische Segmente ([id]) zählen als Treffer. */
function seiteVorhanden(pfad: string): boolean {
  const ohneAnker = pfad.split("#")[0].split("?")[0];
  const segmente = ohneAnker.split("/").filter(Boolean);
  const kandidaten = [join(wurzel, "src", "app", "(portal)"), join(wurzel, "src", "app")];
  return kandidaten.some((basis) => {
    let aktuell = basis;
    for (const seg of segmente) {
      if (existsSync(join(aktuell, seg))) {
        aktuell = join(aktuell, seg);
        continue;
      }
      const dyn = readdirSync(aktuell).find((d) => /^\[.+\]$/.test(d));
      if (!dyn) return false;
      aktuell = join(aktuell, dyn);
    }
    return existsSync(join(aktuell, "page.tsx")) || existsSync(join(aktuell, "route.ts"));
  });
}

describe("Handbuch", () => {
  it("hat Kapitel", () => {
    expect(kapitel.length).toBeGreaterThan(5);
  });

  it("hat eindeutige Slugs und Reihenfolgen je Bereich", () => {
    const slugs = kapitel.map((k) => k.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const b of BEREICHE) {
      const reihen = kapitel.filter((k) => k.bereich === b.key).map((k) => k.reihenfolge);
      expect(new Set(reihen).size, `Bereich ${b.key}`).toBe(reihen.length);
    }
  });

  it("verlinkt nur auf Seiten, die es gibt", () => {
    const tot: string[] = [];
    for (const k of kapitel) {
      for (const href of alleLinks(leseMarkdown(k.markdown))) {
        if (href.startsWith("#")) continue;
        if (!href.startsWith("/")) continue;
        if (href.startsWith("/hilfe/")) {
          const ziel = href.slice("/hilfe/".length).split("#")[0];
          if (!kapitel.some((x) => x.slug === ziel)) tot.push(`${k.slug}: ${href}`);
          continue;
        }
        if (!seiteVorhanden(href)) tot.push(`${k.slug}: ${href}`);
      }
    }
    expect(tot).toEqual([]);
  });

  it("verweist mit Kapitel-Ankern nur auf vorhandene Überschriften", () => {
    const tot: string[] = [];
    for (const k of kapitel) {
      for (const href of alleLinks(leseMarkdown(k.markdown))) {
        const m = /^\/hilfe\/([a-z0-9-]+)#([a-z0-9-]+)$/.exec(href) ?? /^#([a-z0-9-]+)$/.exec(href);
        if (!m) continue;
        const zielSlug = m.length === 3 ? m[1] : k.slug;
        const anker = m.length === 3 ? m[2] : m[1];
        const ziel = kapitel.find((x) => x.slug === zielSlug);
        if (!ziel) continue;
        const ids = leseMarkdown(ziel.markdown)
          .filter((b) => b.art === "ueberschrift")
          .map((b) => (b as { id: string }).id);
        if (!ids.includes(anker)) tot.push(`${k.slug}: ${href}`);
      }
    }
    expect(tot).toEqual([]);
  });

  it("zeigt jeder Rolle mindestens ein Kapitel je passendem Bereich", () => {
    const mieter = kapitel.filter((k) => passtZu(k, { role: "MIETER", selfManaged: false }));
    const eigentuemer = kapitel.filter((k) => passtZu(k, { role: "EIGENTUEMER", selfManaged: true }));
    const verwalter = kapitel.filter((k) => passtZu(k, { role: "VERWALTER", selfManaged: true }));
    expect(mieter.length).toBeGreaterThan(0);
    expect(eigentuemer.length).toBeGreaterThan(mieter.length);
    expect(verwalter.length).toBeGreaterThan(eigentuemer.length);
    // Das Kapitel aus der Kundenzusage muss es geben und ein Verwalter muss es sehen.
    expect(verwalter.some((k) => k.slug === "rechnungen")).toBe(true);
  });
});
