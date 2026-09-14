// pdf.js liefert für sein Worker-Modul keine Typen mit. Gebraucht wird nur die
// Klasse, die pdf.js selbst darin sucht (`globalThis.pdfjsWorker.WorkerMessageHandler`).
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
