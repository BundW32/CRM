// Briefkopf und Anschriftfeld nach DIN 5008 Form B.
//
// Der Bestand traf das Anschriftfeld nicht: linke Kante bei 25 statt 20 mm, die
// Anschrift begann bei rund 50 mm statt 62,7 mm. Im Fensterumschlag rutschte
// die oberste Zeile damit über den Fensterrand, bei vier Zeilen fiel die
// unterste heraus.
//
//   0 mm ┌──────────────────────────────
//  45 mm │ Rücksendeangabe (klein, unterstrichen)  ┐ Zusatz- und
//        │ ggf. Vermerk („Einschreiben")           ┘ Vermerkzone (17,7 mm)
//  62,7 mm │ Anrede / Name                         ┐
//        │ Straße                                  │ Anschriftzone (22,3 mm)
//        │ PLZ Ort                                 ┘
//  98,4 mm │ Betreff
import fs from "node:fs";
import type { Doc } from "./doc";
import { fitText, wrapText } from "../pdf-text";
import { CONTENT_WIDTH, DIN, PAGE, color, mm, size } from "./theme";

export type LetterIssuer = {
  /** Vollständiger Firmenname; wird umgebrochen, nie gekürzt. */
  legalName: string;
  /** Anschrift, E-Mail, Telefon — je Zeile ein Eintrag. */
  lines: string[];
};

export type LetterRecipient = {
  /** Zusatzvermerk der Vermerkzone, z. B. „Einschreiben mit Rückschein". */
  note?: string | null;
  /** Anrede, Name, Straße, PLZ/Ort — je Zeile ein Eintrag. */
  lines: string[];
};

export type LetterHead = {
  issuer: LetterIssuer;
  recipient: LetterRecipient;
  /** Absenderzeile über der Anschrift (Fensterumschlag). */
  returnLine: string;
  /** Pfad zu einem PNG-Logo; fehlt es, bleibt die Stelle leer. */
  logoPath?: string | null;
  /** Rechts neben dem Anschriftfeld: Objekt, Einheit, Vorgang, Datum. */
  infoBlock?: [string, string][];
};

/** Die Anschriftzone fasst fünf Zeilen à 4,23 mm. */
const MAX_ADDRESS_LINES = 5;

/**
 * Logo links, Absender rechts, Akzentlinie darunter. Gemeinsamer Kopf von
 * Briefen und Berichten — sonst hätte jeder Berichtstyp seinen eigenen.
 *
 * Gibt die Höhe der Akzentlinie zurück.
 */
export async function drawBrandHead(
  doc: Doc,
  issuer: LetterIssuer,
  logoPath?: string | null,
): Promise<number> {
  const page = doc.page;
  // Kein randabfallender Farbbalken mehr: den schneidet jeder Bürodrucker ab.
  let logoBottom = PAGE.height - mm(30);
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const image = await doc.pdf.embedPng(fs.readFileSync(logoPath));
      const height = mm(13);
      const width = image.width * (height / image.height);
      page.drawImage(image, {
        x: DIN.marginLeft,
        y: PAGE.height - mm(12) - height,
        width,
        height,
      });
      logoBottom = PAGE.height - mm(12) - height;
    } catch {
      /* Ein unlesbares Logo darf das Dokument nicht verhindern. */
    }
  }

  const headRoom = CONTENT_WIDTH - mm(40); // Platz für das Logo freihalten
  let ry = PAGE.height - mm(15);
  for (const line of wrapText(issuer.legalName, doc.bold, size.small, headRoom).slice(0, 2)) {
    page.drawText(line, {
      x: DIN.marginLeft + CONTENT_WIDTH - doc.bold.widthOfTextAtSize(line, size.small),
      y: ry,
      size: size.small,
      font: doc.bold,
      color: doc.brand,
    });
    ry -= mm(4.2);
  }
  for (const raw of issuer.lines) {
    const line = fitText(raw, doc.font, size.foot, headRoom);
    page.drawText(line, {
      x: DIN.marginLeft + CONTENT_WIDTH - doc.font.widthOfTextAtSize(line, size.foot),
      y: ry,
      size: size.foot,
      font: doc.font,
      color: color.muted,
    });
    ry -= mm(3.4);
  }

  // Akzentlinie in der Mandantenfarbe — im Satzspiegel, nicht am Blattrand.
  page.drawLine({
    start: { x: DIN.marginLeft, y: Math.min(logoBottom, ry) - mm(3) },
    end: { x: DIN.marginLeft + CONTENT_WIDTH, y: Math.min(logoBottom, ry) - mm(3) },
    thickness: 1.2,
    color: doc.brand,
  });

  return Math.min(logoBottom, ry) - mm(3);
}

export async function drawLetterHead(doc: Doc, head: LetterHead): Promise<void> {
  const page = doc.page;

  await drawBrandHead(doc, head.issuer, head.logoPath);

  // ── Anschriftfeld ──────────────────────────────────────────────────────────
  const returnY = PAGE.height - DIN.addressFieldTop - mm(3);
  page.drawText(fitText(head.returnLine, doc.font, 6, DIN.addressFieldWidth), {
    x: DIN.marginLeft,
    y: returnY,
    size: 6,
    font: doc.font,
    color: color.muted,
  });
  page.drawLine({
    start: { x: DIN.marginLeft, y: returnY - mm(1) },
    end: { x: DIN.marginLeft + DIN.addressFieldWidth, y: returnY - mm(1) },
    thickness: 0.4,
    color: color.hair,
  });

  if (head.recipient.note) {
    // Vermerke stehen unten in der Vermerkzone, direkt über der Anschrift.
    page.drawText(fitText(head.recipient.note, doc.bold, size.small, DIN.addressFieldWidth), {
      x: DIN.marginLeft,
      y: PAGE.height - DIN.addressZoneTop + mm(2.5),
      size: size.small,
      font: doc.bold,
      color: color.ink,
    });
  }

  // Anschriften werden UMGEBROCHEN, nie gekürzt: eine abgeschnittene Anschrift
  // ist unzustellbar.
  const addressLines = head.recipient.lines
    .filter((line) => line && line.trim())
    .flatMap((line) => wrapText(line, doc.font, 11, DIN.addressFieldWidth))
    .slice(0, MAX_ADDRESS_LINES);
  let ay = PAGE.height - DIN.addressZoneTop - mm(3.4);
  for (const line of addressLines) {
    page.drawText(line, { x: DIN.marginLeft, y: ay, size: 11, font: doc.font, color: color.ink });
    ay -= DIN.addressLineHeight;
  }

  // ── Informationsblock rechts ───────────────────────────────────────────────
  if (head.infoBlock?.length) {
    let iy = PAGE.height - DIN.addressFieldTop - mm(4);
    const xRight = DIN.marginLeft + CONTENT_WIDTH;
    for (const [rawKey, rawValue] of head.infoBlock) {
      const key = fitText(rawKey, doc.font, size.foot, mm(22));
      page.drawText(key, {
        x: xRight - mm(38) - doc.font.widthOfTextAtSize(key, size.foot),
        y: iy,
        size: size.foot,
        font: doc.font,
        color: color.muted,
      });
      // Längere Angaben (Objektnamen) brechen auf eine zweite Zeile um, statt
      // mit „…" zu enden — ein halber Objektname hilft beim Ablegen nicht.
      const zeilen = wrapText(rawValue, doc.font, size.small, mm(38)).slice(0, 2);
      for (const zeile of zeilen) {
        page.drawText(zeile, {
          x: xRight - doc.font.widthOfTextAtSize(zeile, size.small),
          y: iy - 0.5,
          size: size.small,
          font: doc.font,
          color: color.ink,
        });
        iy -= mm(4);
      }
      iy -= mm(1);
    }
  }

  // Cursor auf die Betreffzeile.
  doc.y = PAGE.height - DIN.subjectTop;
}
