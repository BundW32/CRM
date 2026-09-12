// pdf.js auf dem Server — so geladen, dass es in der Serverless-Funktion läuft.
//
// pdf.js 6 erwartet in Node das native Paket `@napi-rs/canvas` und holt sich
// daraus `DOMMatrix` und `Path2D`. Fehlt das Paket, bricht schon das Laden des
// Moduls ab: `const SCALE_MATRIX = new DOMMatrix()` steht auf oberster Ebene.
// Lokal und in den Tests ist das Paket da (optionale Abhängigkeit, 33 MB
// nativer Code). Im Vercel-Bundle ist es das **nicht** — die Ablauf-Verfolgung
// sieht das `require` in pdf.js nicht, weil es hinter `createRequire` steckt.
// Ergebnis in der Produktion: Import scheitert, die Belegerkennung meldete
// „vermutlich ein Scan" für ein sauberes Text-PDF. Genau so ist es dem
// Testnutzer passiert.
//
// Wir rendern nie, wir lesen nur Text und Anhänge. Dafür reichen zwei Stubs,
// die pdf.js als vorhanden erkennt und deshalb gar nicht erst nach dem
// Canvas-Paket greift. Das ist bewusst kein weiteres natives Paket im Bundle:
// 33 MB für zwei Klassen, die nie benutzt werden.
//
// Zweite Falle: Ohne echten Worker lädt pdf.js seinen Parser über
// `import("./pdf.worker.mjs")` mit einem Pfad zur Laufzeit — den die
// Ablauf-Verfolgung ebenfalls nicht sieht. Deshalb wird das Worker-Modul hier
// mit festem Namen importiert (das wird verfolgt) und pdf.js über
// `globalThis.pdfjsWorker` untergeschoben.
//
// `pdfjs-server.test.ts` stellt den Produktionsfall nach: ein Kindprozess, in
// dem `@napi-rs/canvas` nicht auflösbar ist.

type PdfjsModul = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/**
 * Gerade so viel `DOMMatrix`, wie pdf.js beim Laden und beim Textlesen
 * anfasst. Die Rechenmethoden geben `this` zurück — Verkettungen wie
 * `new DOMMatrix().scaleSelf(…).translateSelf(…)` laufen damit durch, auch
 * wenn ihr Ergebnis nirgends gebraucht wird.
 */
class DomMatrixStub {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
  scaleSelf() {
    return this;
  }
  translateSelf() {
    return this;
  }
  multiplySelf() {
    return this;
  }
  preMultiplySelf() {
    return this;
  }
  invertSelf() {
    return this;
  }
  scale() {
    return new DomMatrixStub();
  }
  translate() {
    return new DomMatrixStub();
  }
  multiply() {
    return new DomMatrixStub();
  }
  inverse() {
    return new DomMatrixStub();
  }
  transformPoint(p: { x?: number; y?: number } = {}) {
    return { x: p.x ?? 0, y: p.y ?? 0, z: 0, w: 1 };
  }
  toFloat32Array() {
    return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]);
  }
}

class Path2DStub {
  rect() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  closePath() {}
  addPath() {}
}

/** Setzt die Stubs, falls die Umgebung die Klassen nicht kennt (Node ohne Canvas). */
export function installiereDomStubs(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = DomMatrixStub;
  if (typeof g.Path2D === "undefined") g.Path2D = Path2DStub;
}

let geladen: Promise<PdfjsModul> | null = null;

/** pdf.js einmal laden, mit Stubs und vorgeladenem Worker. */
export function ladePdfjs(): Promise<PdfjsModul> {
  geladen ??= (async () => {
    installiereDomStubs();
    // Erst der Worker: pdf.js prüft `globalThis.pdfjsWorker` beim Anlegen des
    // ersten Dokuments — steht er da, findet kein Pfad-Import mehr statt.
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  })();
  return geladen;
}
