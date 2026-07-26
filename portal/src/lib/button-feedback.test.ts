import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Wächter gegen eine Lücke, die sich über die Zeit angesammelt hatte: Buttons,
 * die eine Server-Action auslösen, aber nichts zurückmelden. Man klickt, es
 * passiert sichtbar nichts – also klickt man nochmal.
 *
 * Geprüft wird das, was sich statisch prüfen lässt:
 *   1. Destruktive Aktionen fragen nach, bevor sie vollziehen.
 *   2. Submit-Buttons zeigen einen Pending-Zustand.
 *
 * Beides über eine Ausnahmeliste, damit begründete Sonderfälle bestehen
 * bleiben, ohne den Test abzuschalten. Wer hier etwas einträgt, sollte
 * dazuschreiben, warum.
 */

const FEEDBACK_KOMPONENTEN = [
  "PendingButton",
  "SubmitButton",
  "ConfirmActionButton",
  "ConfirmDeleteButton",
  "DeleteSubmit",
];

/** Zeichenbereiche aller `<form action={…}>` – optional nach Action gefiltert. */
function formBereiche(txt: string, actionFilter?: RegExp) {
  const bereiche: Array<{ von: number; bis: number; action: string }> = [];
  const re = /<form\s+action=\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    if (actionFilter && !actionFilter.test(m[1])) continue;
    const bis = txt.indexOf("</form>", m.index);
    if (bis !== -1) bereiche.push({ von: m.index, bis, action: m[1] });
  }
  return bereiche;
}

function tsxDateien(): string[] {
  return execFileSync("git", ["ls-files", "src/**/*.tsx"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

describe("Destruktive Aktionen", () => {
  // Icon-Buttons in dichten Listenzeilen; dort sitzt die Rückfrage in der
  // Zeile selbst bzw. die Aktion ist umkehrbar (Wiedervorlage, Deaktivierung).
  const AUSNAHMEN = new Set<string>([
    "src/app/(portal)/verwaltung/objekte/[id]/bearbeiten/page.tsx:removePropertyOwner",
    "src/app/(portal)/verwaltung/objekte/[id]/bearbeiten/page.tsx:removeUnitOwner",
    "src/app/uebergabe/[id]/raeume/RaeumeClient.tsx:deleteRoom",
    "src/app/uebergabe/[id]/raeume/RaeumeClient.tsx:deletePhoto",
  ]);

  it("fragen nach, bevor sie vollziehen", () => {
    const fehlend: string[] = [];
    for (const datei of tsxDateien()) {
      const txt = readFileSync(datei, "utf8");
      for (const b of formBereiche(txt, /^(delete|remove|archive|withdraw|cancel)/i)) {
        const koerper = txt.slice(b.von, b.bis);
        const hatRueckfrage = /Confirm(Action|Delete)Button/.test(koerper);
        if (!hatRueckfrage && !AUSNAHMEN.has(`${datei}:${b.action}`)) {
          fehlend.push(`${datei}:${b.action}`);
        }
      }
    }
    expect(fehlend, `Ohne Rückfrage: ${fehlend.join(", ")}`).toEqual([]);
  });
});

describe("Submit-Buttons", () => {
  // Buttons, die keinen Pending-Zustand tragen können oder brauchen:
  // Filter-/Sortier-Knöpfe (kein Server-Roundtrip mit Datenänderung) und
  // Icon-Buttons, deren Beschriftung der Spinner verdrängen würde.
  const AUSNAHMEN = /aria-label|formAction|onClick|disabled=/;

  it("zeigen, dass der Klick angekommen ist", () => {
    const nackt: string[] = [];
    for (const datei of tsxDateien()) {
      const txt = readFileSync(datei, "utf8");
      for (const b of formBereiche(txt)) {
        const koerper = txt.slice(b.von, b.bis);
        // Reine Text-Submit-Buttons ohne Feedback-Komponente
        const re = /<button\s+type="submit"([^>]*)>\s*([^<>{}]+?)\s*<\/button>/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(koerper))) {
          if (AUSNAHMEN.test(m[1])) continue;
          if (FEEDBACK_KOMPONENTEN.some((k) => koerper.includes(k))) continue;
          nackt.push(`${datei}:${b.action} („${m[2].trim()}")`);
        }
      }
    }
    expect(nackt, `Ohne Pending-Zustand: ${nackt.join(", ")}`).toEqual([]);
  });
});
