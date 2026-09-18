// Ein kleiner Markdown-Leser für das Handbuch.
//
// Bewusst selbst geschrieben statt eine Bibliothek zu ziehen: Die Kapitel
// schreiben wir selbst, sie brauchen Überschriften, Absätze, Listen, Tabellen,
// Zitate und ein paar Auszeichnungen im Satz — nicht HTML, nicht Fußnoten,
// nicht eingebettete Skripte. Ein Leser, der genau das kann, ist in einer
// Bildschirmseite zu überblicken und lässt nichts durch, was er nicht kennt:
// Unbekannte Zeichen bleiben Text. Rohes HTML wird nie ausgegeben.
//
// Ausgabe ist ein Baum, keine Zeichenkette — gerendert wird in
// `components/handbuch.tsx` mit React, interne Links als <Link>.

export type Inline =
  | { art: "text"; text: string }
  | { art: "fett"; kinder: Inline[] }
  | { art: "kursiv"; kinder: Inline[] }
  | { art: "code"; text: string }
  | { art: "link"; href: string; kinder: Inline[] };

export type Block =
  | { art: "ueberschrift"; ebene: 2 | 3; id: string; kinder: Inline[] }
  | { art: "absatz"; kinder: Inline[] }
  | { art: "liste"; nummeriert: boolean; punkte: Inline[][] }
  | { art: "zitat"; kinder: Inline[] }
  | { art: "tabelle"; kopf: Inline[][]; zeilen: Inline[][][] }
  | { art: "linie" };

/** Anker für eine Überschrift: klein, ohne Umlaute, Bindestriche. */
export function ankerFuer(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nur der Text einer Zeile, ohne Auszeichnungen — für Anker und Inhaltsverzeichnis. */
export function nurText(kinder: Inline[]): string {
  return kinder
    .map((k) => {
      if (k.art === "text" || k.art === "code") return k.text;
      return nurText(k.kinder);
    })
    .join("");
}

// ── Auszeichnungen im Satz ──────────────────────────────────────────────────

const INLINE = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;

export function leseInline(text: string): Inline[] {
  const teile: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) {
      teile.push({ art: "text", text: rest });
      break;
    }
    if (m.index > 0) teile.push({ art: "text", text: rest.slice(0, m.index) });
    if (m[2] !== undefined) teile.push({ art: "fett", kinder: leseInline(m[2]) });
    else if (m[3] !== undefined) teile.push({ art: "kursiv", kinder: leseInline(m[3]) });
    else if (m[4] !== undefined) teile.push({ art: "code", text: m[4] });
    else if (m[5] !== undefined && m[6] !== undefined) {
      teile.push({ art: "link", href: m[6], kinder: leseInline(m[5]) });
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return teile;
}

// ── Blöcke ──────────────────────────────────────────────────────────────────

function tabellenZellen(zeile: string): string[] {
  return zeile
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((z) => z.trim());
}

function istTrennzeile(zeile: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(zeile.trim());
}

export function leseMarkdown(quelle: string): Block[] {
  const zeilen = quelle.replace(/\r\n/g, "\n").split("\n");
  const bloecke: Block[] = [];
  let i = 0;

  const absatzSammeln = (): string[] => {
    const teile: string[] = [];
    while (i < zeilen.length) {
      const z = zeilen[i];
      if (z.trim() === "" || /^(#{2,3} |[-*] |\d+\. |> |\||---\s*$)/.test(z)) break;
      teile.push(z.trim());
      i++;
    }
    return teile;
  };

  while (i < zeilen.length) {
    const zeile = zeilen[i];
    const t = zeile.trim();

    if (t === "") {
      i++;
      continue;
    }

    if (/^---\s*$/.test(t)) {
      bloecke.push({ art: "linie" });
      i++;
      continue;
    }

    const h = /^(#{2,3}) (.+)$/.exec(t);
    if (h) {
      const kinder = leseInline(h[2].trim());
      bloecke.push({
        art: "ueberschrift",
        ebene: h[1].length === 2 ? 2 : 3,
        id: ankerFuer(nurText(kinder)),
        kinder,
      });
      i++;
      continue;
    }

    // Eine Überschrift erster Ebene gibt es im Kapitel nicht — der Titel
    // steht in den Kopfdaten. Taucht sie doch auf, wird sie zur zweiten.
    const h1 = /^# (.+)$/.exec(t);
    if (h1) {
      const kinder = leseInline(h1[1].trim());
      bloecke.push({ art: "ueberschrift", ebene: 2, id: ankerFuer(nurText(kinder)), kinder });
      i++;
      continue;
    }

    if (t.startsWith("> ")) {
      const teile: string[] = [];
      while (i < zeilen.length && zeilen[i].trim().startsWith(">")) {
        teile.push(zeilen[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      bloecke.push({ art: "zitat", kinder: leseInline(teile.join(" ")) });
      continue;
    }

    if (t.startsWith("|")) {
      const roh: string[] = [];
      while (i < zeilen.length && zeilen[i].trim().startsWith("|")) {
        roh.push(zeilen[i]);
        i++;
      }
      const kopf = tabellenZellen(roh[0]).map(leseInline);
      const koerper = roh.slice(1).filter((z) => !istTrennzeile(z));
      bloecke.push({
        art: "tabelle",
        kopf,
        zeilen: koerper.map((z) => tabellenZellen(z).map(leseInline)),
      });
      continue;
    }

    const listenpunkt = /^([-*]|\d+\.) (.*)$/.exec(t);
    if (listenpunkt) {
      const nummeriert = /^\d+\.$/.test(listenpunkt[1]);
      const punkte: string[] = [];
      while (i < zeilen.length) {
        const z = zeilen[i];
        const p = /^([-*]|\d+\.) (.*)$/.exec(z.trim());
        if (p && (/^\d+\.$/.test(p[1]) === nummeriert) && !/^\s/.test(z)) {
          punkte.push(p[2]);
          i++;
        } else if (/^\s{2,}\S/.test(z) && punkte.length > 0) {
          // Eingerückte Folgezeile gehört zum letzten Punkt.
          punkte[punkte.length - 1] += " " + z.trim();
          i++;
        } else {
          break;
        }
      }
      bloecke.push({ art: "liste", nummeriert, punkte: punkte.map(leseInline) });
      continue;
    }

    const teile = absatzSammeln();
    if (teile.length > 0) {
      bloecke.push({ art: "absatz", kinder: leseInline(teile.join(" ")) });
    } else {
      i++;
    }
  }
  return bloecke;
}

/** Die Zwischenüberschriften eines Kapitels — für das Inhaltsverzeichnis. */
export function gliederung(bloecke: Block[]): { id: string; titel: string; ebene: 2 | 3 }[] {
  return bloecke
    .filter((b): b is Extract<Block, { art: "ueberschrift" }> => b.art === "ueberschrift")
    .map((b) => ({ id: b.id, titel: nurText(b.kinder), ebene: b.ebene }));
}
