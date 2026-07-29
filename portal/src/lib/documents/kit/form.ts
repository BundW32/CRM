// Formularbausteine: Kästen, Ankreuzfelder, Raster.
//
// Behördenformulare — allen voran die Wohnungsgeberbestätigung nach § 19 BMG —
// leben von sichtbaren Feldern: Wer sie ausfüllt oder gegenliest, muss auf
// einen Blick sehen, welche Angabe wohin gehört. Fließtext leistet das nicht.
//
// Die Bausteine rechnen mit denselben Rändern wie der Rest des Kits und
// begrenzen sich selbst gegen den Satzspiegel.
import type { Doc } from "./doc";
import { CONTENT_WIDTH, DIN, color, mm, size } from "./theme";
import { fitText } from "../pdf-text";

const BORDER = color.muted;
const HAIR = color.hair;
const HEADER_BG = color.panel;

/** Ankreuzfeld. `y` ist die Oberkante des Kästchens. */
export function checkbox(doc: Doc, x: number, y: number, checked: boolean): void {
  const s = mm(3.5);
  doc.page.drawRectangle({
    x,
    y: y - s,
    width: s,
    height: s,
    borderColor: color.ink,
    borderWidth: 0.75,
    color: undefined,
  });
  if (checked) {
    const pad = mm(0.7);
    doc.page.drawLine({
      start: { x: x + pad, y: y - s + pad },
      end: { x: x + s - pad, y: y - pad },
      thickness: 1.2,
      color: color.ink,
    });
    doc.page.drawLine({
      start: { x: x + pad, y: y - pad },
      end: { x: x + s - pad, y: y - s + pad },
      thickness: 1.2,
      color: color.ink,
    });
  }
}

/** Ankreuzfeld mit Beschriftung daneben, auf der laufenden Zeile. */
export function checkboxLine(
  doc: Doc,
  label: string,
  checked: boolean,
  options: { x?: number; gap?: number } = {},
): void {
  const x = options.x ?? DIN.marginLeft;
  doc.ensure(mm(6));
  checkbox(doc, x, doc.y + mm(3), checked);
  const textX = x + mm(5.5);
  doc.page.drawText(
    fitText(label, doc.font, size.small, DIN.marginLeft + CONTENT_WIDTH - textX),
    { x: textX, y: doc.y, size: size.small, font: doc.font, color: color.ink },
  );
  doc.y -= options.gap ?? mm(6);
}

export type FormRow = { label: string; value: string };

/**
 * Umrandeter Abschnitt mit grauer Kopfzeile und beschrifteten Zeilen.
 *
 * Der Kasten bleibt als Ganzes zusammen: Ein Formularfeld, dessen Beschriftung
 * auf der Vorseite steht, ist unbrauchbar.
 */
export function formSection(
  doc: Doc,
  header: string,
  rows: FormRow[],
  options: { labelWidth?: number } = {},
): void {
  const headerHeight = mm(6.5);
  const rowHeight = mm(7.5);
  const labelWidth = options.labelWidth ?? mm(55);
  const height = headerHeight + rows.length * rowHeight;

  doc.ensure(height + mm(4));
  const top = doc.y + mm(4);
  const bottom = top - height;
  const left = DIN.marginLeft;
  const right = left + CONTENT_WIDTH;

  doc.page.drawRectangle({
    x: left,
    y: top - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: HEADER_BG,
  });
  // Rahmen als vier Linien, damit die Füllung ihn nicht überdeckt.
  const frame = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness = 0.75,
    stroke = BORDER,
  ) => doc.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: stroke });
  frame(left, top, right, top);
  frame(left, bottom, right, bottom);
  frame(left, bottom, left, top);
  frame(right, bottom, right, top);
  frame(left, top - headerHeight, right, top - headerHeight, 0.5);

  doc.page.drawText(fitText(header, doc.bold, size.foot, CONTENT_WIDTH - mm(4)), {
    x: left + mm(2),
    y: top - headerHeight + mm(2),
    size: size.foot,
    font: doc.bold,
    color: color.ink,
  });

  let rowY = top - headerHeight;
  rows.forEach((row, i) => {
    rowY -= rowHeight;
    if (i < rows.length - 1) frame(left, rowY, right, rowY, 0.4, HAIR);
    frame(left + labelWidth, rowY, left + labelWidth, rowY + rowHeight, 0.4, HAIR);
    doc.page.drawText(fitText(row.label, doc.font, size.foot, labelWidth - mm(4)), {
      x: left + mm(2),
      y: rowY + mm(2.6),
      size: size.foot,
      font: doc.font,
      color: color.muted,
    });
    if (row.value) {
      doc.page.drawText(
        fitText(row.value, doc.font, size.small, CONTENT_WIDTH - labelWidth - mm(4)),
        {
          x: left + labelWidth + mm(2),
          y: rowY + mm(2.4),
          size: size.small,
          font: doc.font,
          color: color.ink,
        },
      );
    }
  });

  doc.y = bottom - mm(5);
}

/**
 * Ausfüllraster mit fester Zeilenzahl — auch leere Zeilen bleiben stehen,
 * damit von Hand nachgetragen werden kann.
 */
export function formGrid(
  doc: Doc,
  headers: string[],
  rows: string[][],
  totalRows: number,
): void {
  const headerHeight = mm(6);
  const rowHeight = mm(6);
  const height = headerHeight + totalRows * rowHeight;

  doc.ensure(height + mm(4));
  const top = doc.y + mm(4);
  const bottom = top - height;
  const left = DIN.marginLeft;
  const right = left + CONTENT_WIDTH;
  const colWidth = CONTENT_WIDTH / headers.length;

  doc.page.drawRectangle({
    x: left,
    y: top - headerHeight,
    width: CONTENT_WIDTH,
    height: headerHeight,
    color: HEADER_BG,
  });
  const frame = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness = 0.75,
    stroke = BORDER,
  ) => doc.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: stroke });
  frame(left, top, right, top);
  frame(left, bottom, right, bottom);
  frame(left, bottom, left, top);
  frame(right, bottom, right, top);
  frame(left, top - headerHeight, right, top - headerHeight, 0.5);

  headers.forEach((headerText, i) => {
    doc.page.drawText(fitText(headerText, doc.bold, size.foot, colWidth - mm(4)), {
      x: left + i * colWidth + mm(2),
      y: top - headerHeight + mm(1.8),
      size: size.foot,
      font: doc.bold,
      color: color.ink,
    });
    if (i > 0) frame(left + i * colWidth, bottom, left + i * colWidth, top, 0.4, HAIR);
  });

  let rowY = top - headerHeight;
  for (let i = 0; i < totalRows; i++) {
    rowY -= rowHeight;
    if (i < totalRows - 1) frame(left, rowY, right, rowY, 0.3, HAIR);
    const row = rows[i];
    if (!row) continue;
    row.forEach((cell, c) => {
      if (!cell) return;
      doc.page.drawText(fitText(cell, doc.font, size.small, colWidth - mm(4)), {
        x: left + c * colWidth + mm(2),
        y: rowY + mm(2),
        size: size.small,
        font: doc.font,
        color: color.ink,
      });
    });
  }

  doc.y = bottom - mm(5);
}
