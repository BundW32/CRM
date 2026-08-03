import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Tour } from "./tour";

// Nur die Router-Anbindung wird ersetzt — sie braucht einen Kontext, den Next
// im Betrieb stellt und der mit der geprüften Frage nichts zu tun hat. Alles
// andere an der Komponente läuft echt, sonst prüfte der Test seine eigene Attrappe.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/dashboard",
}));

// Die Tour muss sich **auf dem Server** rendern lassen.
//
// Anlass: In der Sprechblase stand `window.innerWidth` — im Zweig, der greift,
// solange noch kein Ziel gemessen ist. Genau dieser Zweig ist der Serverfall.
// Die Folge war ein `ReferenceError` und damit **HTTP 500 auf jeder Seite**,
// solange die Tour lief. Im Browser sah man davon nichts: React reicht den
// Client-Teil nach, die Seite baut sich auf, alles wirkt heil. Aufgefallen ist
// es erst beim Mitlesen der Antwortcodes.
//
// Deshalb dieser Test und nicht bloß eine Regel gegen `window`: Geprüft wird
// nicht, ob das Wort im Quelltext steht — in Effekten ist es völlig richtig —,
// sondern ob das Rendern ohne Browser gelingt.
describe("Tour: Serverrendern", () => {
  const schritte = [
    { titel: "Willkommen", text: "Kurz erklärt." },
    { titel: "Zweiter Schritt", text: "Noch etwas.", ziel: "irgendwo" },
  ];

  it("rendert ohne window", () => {
    // `renderToString` läuft in der Node-Umgebung dieser Testsuite, in der es
    // kein `window` gibt — dieselbe Lage wie im Produktionsserver.
    expect(typeof globalThis.window).toBe("undefined");
    const html = renderToString(<Tour schritte={schritte} beenden={() => {}} />);
    expect(html).toContain("Willkommen");
  });

  it("misst die Breite der Sprechblase nicht selbst", () => {
    // Die Breite kommt aus CSS (`min(...)`), nicht aus einer gerechneten Zahl.
    // Eine Zahl an dieser Stelle hieße, dass wieder gemessen wird.
    const html = renderToString(<Tour schritte={schritte} beenden={() => {}} />);
    expect(html).toMatch(/width:\s*min\(/);
  });
});
