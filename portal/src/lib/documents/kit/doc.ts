// Die Seiten- und Satzverwaltung, auf der alle Dokumente aufsetzen.
//
// Der Bestand hatte in jedem Generator dieselben zehn Zeilen: ein `y`, das
// heruntergezählt wird, ein handgeschriebenes `ensure`, ein `drawRight`. Drei
// Generatoren hatten das `ensure` schlicht vergessen — dort verschwand Inhalt
// unter dem Blattrand, ohne Fehlermeldung.
//
// Hier gibt es das genau einmal, und jeder Baustein begrenzt sich selbst gegen
// seine eigene Box. Ein Aufrufer kann das nicht mehr vergessen.
import { PDFDocument, PDFPage, type PDFFont, type PDFImage, type RGB } from "pdf-lib";
import { fitText, wrapText } from "../pdf-text";
import { embedFonts } from "./fonts";
import {
  CONTENT_WIDTH,
  DIN,
  MEASURE,
  PAGE,
  color,
  leading,
  mm,
  size,
} from "./theme";

export type DocMeta = {
  /** Erscheint in der Fensterleiste des Betrachters und in der Ablage. */
  title: string;
  author: string;
  subject?: string;
  /** Mandantenfarbe (#rrggbb bereits aufgelöst). */
  brand?: RGB;
  /**
   * Falz- und Lochmarken. Standard ist `true`, weil die meisten Dokumente in
   * einen Fensterumschlag gehen — auch die je Einheit versandten Abrechnungen
   * und Wirtschaftspläne. Wer nie kuvertiert (Beschluss-Sammlung, Protokolle),
   * schaltet sie ab: Sonst stehen unerklärliche Striche am linken Rand.
   */
  marks?: boolean;
};

export type TableColumn = {
  header: string;
  /** Anteil an der Satzbreite; die Werte werden ins Verhältnis gesetzt. */
  width: number;
  align?: "left" | "right";
};

export type TableCell = { text: string; strong?: boolean; color?: RGB };

export type TextOptions = {
  size?: number;
  font?: PDFFont;
  color?: RGB;
  x?: number;
  lead?: number;
};

export class Doc {
  readonly pdf: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  readonly brand: RGB;
  private readonly marks: boolean;

  page!: PDFPage;
  y = 0;
  private readonly pages: PDFPage[] = [];
  /** Einmal eingebettete Bilder, nach Quelle. Siehe `image()`. */
  private readonly images = new Map<string | Uint8Array, PDFImage>();

  private constructor(
    pdf: PDFDocument,
    font: PDFFont,
    bold: PDFFont,
    brand: RGB,
    marks: boolean,
  ) {
    this.pdf = pdf;
    this.font = font;
    this.bold = bold;
    this.brand = brand;
    this.marks = marks;
  }

  static async create(meta: DocMeta): Promise<Doc> {
    const pdf = await PDFDocument.create();
    const { regular, bold } = await embedFonts(pdf);
    // Metadaten setzte bisher kein einziges Dokument — im Betrachter stand
    // nichts, und in einer Ablage ließ sich nichts wiederfinden.
    pdf.setTitle(meta.title);
    pdf.setAuthor(meta.author);
    if (meta.subject) pdf.setSubject(meta.subject);
    pdf.setCreator(meta.author);
    pdf.setProducer("B&W Portal");
    pdf.setCreationDate(new Date());
    return new Doc(pdf, regular, bold, meta.brand ?? color.brand, meta.marks ?? true);
  }

  // ── Seiten ─────────────────────────────────────────────────────────────────

  newPage(): PDFPage {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.y = PAGE.height - mm(30);
    if (this.marks) this.drawMarks();
    return this.page;
  }

  /** Falz- und Lochmarken. Ohne sie faltet niemand passgenau, und die Anschrift sitzt trotz korrektem Feld schief im Fenster. */
  private drawMarks(): void {
    const mark = (fromTop: number, length: number) =>
      this.page.drawLine({
        start: { x: mm(8), y: PAGE.height - fromTop },
        end: { x: mm(8) + length, y: PAGE.height - fromTop },
        thickness: 0.5,
        color: color.hair,
      });
    mark(DIN.foldMark1, mm(4));
    mark(DIN.foldMark2, mm(4));
    mark(DIN.holeMark, mm(7));
  }

  /**
   * Bettet ein Bild EINMAL je Dokument ein und gibt es danach wieder zurück.
   *
   * `embedPng` legt bei jedem Aufruf ein neues Bildobjekt an. Der Berichtskopf
   * läuft in den Einzelabrechnungen je Einheit einmal — bei 120 Einheiten trug
   * das Dokument 120 Kopien desselben Logos: 19,6 MB statt 0,5 MB und 48 s
   * statt 19 s. Aufgefallen war es nie, weil ein PDF mit 120 Logos genauso
   * aussieht wie eines mit einem.
   *
   * PNG oder JPEG — ein hochgeladenes Logo ist mal das eine, mal das andere.
   */
  async image(source: string | Uint8Array, bytes: Uint8Array): Promise<PDFImage> {
    const bekannt = this.images.get(source);
    if (bekannt) return bekannt;
    let bild: PDFImage;
    try {
      bild = await this.pdf.embedPng(bytes);
    } catch {
      bild = await this.pdf.embedJpg(bytes);
    }
    this.images.set(source, bild);
    return bild;
  }

  /** Bricht um, wenn die nächsten `needed` Punkte nicht mehr über die Fußzeile passen. */
  ensure(needed: number): void {
    if (this.y - needed >= PAGE.height - DIN.footerTop + mm(6)) return;
    this.newPage();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  // ── Text ───────────────────────────────────────────────────────────────────

  /** Eine Zeile. Zu breiter Text wird gekürzt — nie über den Satzspiegel hinaus. */
  text(value: string, options: TextOptions = {}): void {
    const fontSize = options.size ?? size.body;
    const font = options.font ?? this.font;
    const x = options.x ?? DIN.marginLeft;
    const lead =
      options.lead ??
      (fontSize <= size.foot ? leading.foot : fontSize <= size.small ? leading.small : leading.body);
    const room = DIN.marginLeft + CONTENT_WIDTH - x;
    for (const line of String(value).split("\n")) {
      this.ensure(lead);
      this.page.drawText(fitText(line, font, fontSize, room), {
        x,
        y: this.y,
        size: fontSize,
        font,
        color: options.color ?? color.ink,
      });
      this.y -= lead;
    }
  }

  /** Fließtext. Bricht um, statt zu kürzen. */
  para(
    value: string,
    options: TextOptions & { width?: number } = {},
  ): void {
    const fontSize = options.size ?? size.body;
    const font = options.font ?? this.font;
    const lead = options.lead ?? leading.body;
    for (const line of wrapText(value, font, fontSize, options.width ?? MEASURE)) {
      this.ensure(lead);
      this.page.drawText(line, {
        x: DIN.marginLeft,
        y: this.y,
        size: fontSize,
        font,
        color: options.color ?? color.ink,
      });
      this.y -= lead;
    }
  }

  /**
   * Höhe, die `para` für diesen Text brauchen wird.
   *
   * Damit lässt sich ein Block, der zusammenbleiben soll, exakt reservieren.
   * Geschätzte Reserven gehen in beide Richtungen schief: zu knapp, und der
   * Block reißt doch auseinander; zu großzügig, und eine Seite bricht um,
   * obwohl der Inhalt gepasst hätte.
   */
  measure(
    value: string,
    options: { size?: number; width?: number; lead?: number; font?: PDFFont } = {},
  ): number {
    const fontSize = options.size ?? size.body;
    const font = options.font ?? this.font;
    const lead = options.lead ?? leading.body;
    return wrapText(value, font, fontSize, options.width ?? MEASURE).length * lead;
  }

  /** Betreff samt Unterzeile. Bricht um — im Bestand lief er über die Blattkante. */
  subject(title: string, sub?: string | null): void {
    this.para(title, { size: size.section, font: this.bold, width: CONTENT_WIDTH, lead: mm(6) });
    if (sub) {
      this.para(sub, {
        size: size.small,
        color: color.muted,
        width: CONTENT_WIDTH,
        lead: mm(4.5),
      });
    }
    this.y -= mm(4.5);
  }

  /** Rechtsbündig auf einer festen Kante — für Beträge. */
  right(value: string, options: TextOptions & { xRight?: number; y?: number } = {}): void {
    const fontSize = options.size ?? size.body;
    const font = options.font ?? this.font;
    const xRight = options.xRight ?? DIN.marginLeft + CONTENT_WIDTH;
    this.page.drawText(value, {
      x: xRight - font.widthOfTextAtSize(value, fontSize),
      y: options.y ?? this.y,
      size: fontSize,
      font,
      color: options.color ?? color.ink,
    });
  }

  space(value = mm(4)): void {
    this.y -= value;
  }

  /**
   * Trennlinie über die Satzbreite.
   *
   * Oben und unten getrennte Abstände, und der untere ist größer: `y` ist die
   * GRUNDLINIE der nächsten Zeile, deren Oberlängen rund 0,72 × Schriftgröße
   * darüber hinausragen. Mit gleichem Abstand schnitt die Linie durch die
   * Buchstaben der Folgezeile.
   */
  rule(
    options: {
      width?: number;
      color?: RGB;
      thickness?: number;
      gapAbove?: number;
      gapBelow?: number;
    } = {},
  ): void {
    this.y -= options.gapAbove ?? mm(3);
    this.page.drawLine({
      start: { x: DIN.marginLeft, y: this.y },
      end: { x: DIN.marginLeft + (options.width ?? CONTENT_WIDTH), y: this.y },
      thickness: options.thickness ?? 0.6,
      color: options.color ?? color.hair,
    });
    this.y -= options.gapBelow ?? mm(4.5);
  }

  /**
   * Spaltentabelle mit Kopfzeile. Bricht um und wiederholt die Kopfzeile auf
   * der Folgeseite — eine Tabelle, deren Spalten man nach dem Umbruch raten
   * muss, ist keine.
   */
  table(columns: TableColumn[], rows: TableCell[][]): void {
    // Steg zwischen den Spalten. Ohne ihn stößt ein rechtsbündiger Betrag
    // unmittelbar an den linken Rand der Folgespalte — im ersten Entwurf klebten
    // „15.410,00 €" und „Verbrauch" ohne Lücke aneinander.
    const GUTTER = mm(4);
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    const scale = CONTENT_WIDTH / total;
    const widths = columns.map((c) => c.width * scale);
    const xs: number[] = [];
    let cursor = DIN.marginLeft;
    for (const width of widths) {
      xs.push(cursor);
      cursor += width;
    }
    // Die letzte Spalte endet am Satzspiegel, alle anderen einen Steg davor.
    const inner = widths.map((width, i) => width - (i === columns.length - 1 ? 0 : GUTTER));

    const place = (text: string, i: number, font: PDFFont, fontSize: number): number =>
      columns[i].align === "right"
        ? xs[i] + inner[i] - font.widthOfTextAtSize(text, fontSize)
        : xs[i];

    const header = () => {
      columns.forEach((column, i) => {
        const text = fitText(column.header, this.bold, size.foot, inner[i]);
        this.page.drawText(text, {
          x: place(text, i, this.bold, size.foot),
          y: this.y,
          size: size.foot,
          font: this.bold,
          color: color.muted,
        });
      });
      this.rule({ gapAbove: mm(1.5), gapBelow: mm(4) });
    };

    this.ensure(mm(18));
    header();

    for (const row of rows) {
      // Linksbündige Zellen brechen um, statt zu kürzen: Ein Kostenname, der
      // als „Mieteinnahmen Gemeinschaftsfläche (Einnah…" endet, ist in einer
      // Abrechnung nicht prüfbar. Rechtsbündige Beträge bleiben einzeilig.
      const cellLines = row.map((cell, i) => {
        const font = cell.strong ? this.bold : this.font;
        return columns[i].align === "right"
          ? [fitText(cell.text, font, size.body, inner[i])]
          : wrapText(cell.text, font, size.body, inner[i]);
      });
      const height = Math.max(1, ...cellLines.map((lines) => lines.length)) * leading.body;

      if (this.y - height < PAGE.height - DIN.footerTop + mm(6)) {
        this.newPage();
        header();
      }
      row.forEach((cell, i) => {
        const font = cell.strong ? this.bold : this.font;
        cellLines[i].forEach((text, line) => {
          this.page.drawText(text, {
            x: place(text, i, font, size.body),
            y: this.y - line * leading.body,
            size: size.body,
            font,
            color: cell.color ?? color.ink,
          });
        });
      });
      this.y -= height;
    }
  }

  // ── Bausteine ──────────────────────────────────────────────────────────────

  /** Eine Zeile mit Bezeichnung links und Betrag rechts. Die Bezeichnung weicht dem Betrag. */
  amountRow(label: string, value: string, options: { strong?: boolean; color?: RGB } = {}): void {
    const font = options.strong ? this.bold : this.font;
    this.ensure(leading.body);
    const room = CONTENT_WIDTH - font.widthOfTextAtSize(value, size.body) - mm(4);
    this.page.drawText(fitText(label, font, size.body, room), {
      x: DIN.marginLeft,
      y: this.y,
      size: size.body,
      font,
      color: options.color ?? color.ink,
    });
    this.right(value, { font, color: options.color ?? color.ink });
    this.y -= leading.body;
  }

  /** Der Ergebnisblock: die eine Zahl, auf die es ankommt. */
  amountPanel(
    label: string,
    value: string,
    options: { sub?: string | null; tone?: "due" | "credit" } = {},
  ): void {
    const height = options.sub ? mm(20) : mm(14);
    this.ensure(height + mm(4));
    const top = this.y + mm(4);
    this.page.drawRectangle({
      x: DIN.marginLeft,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: color.panel,
    });
    this.page.drawRectangle({
      x: DIN.marginLeft,
      y: top - height,
      width: mm(1.2),
      height,
      color: this.brand,
    });
    const labelY = options.sub ? top - mm(8) : top - mm(9.5);
    const valueWidth = this.bold.widthOfTextAtSize(value, 15);
    this.page.drawText(fitText(label, this.bold, size.body, CONTENT_WIDTH - mm(12) - valueWidth - mm(4)), {
      x: DIN.marginLeft + mm(6),
      y: labelY,
      size: size.body,
      font: this.bold,
      color: color.ink,
    });
    this.right(value, {
      size: 15,
      font: this.bold,
      color: options.tone === "credit" ? color.credit : color.due,
      xRight: DIN.marginLeft + CONTENT_WIDTH - mm(6),
      y: labelY - 1.5,
    });
    if (options.sub) {
      this.page.drawText(fitText(options.sub, this.font, size.small, CONTENT_WIDTH - mm(12)), {
        x: DIN.marginLeft + mm(6),
        y: top - mm(15),
        size: size.small,
        font: this.font,
        color: color.muted,
      });
    }
    this.y = top - height - mm(6);
  }

  /**
   * Bezeichnung/Wert mit fester Wertespalte — Bankverbindungen, Eckdaten.
   *
   * Der Wert bricht um, statt zu kürzen: Anschriften, Notizen und Links sind
   * genau die Angaben, bei denen ein „…" die Auskunft wertlos macht.
   */
  defList(
    rows: [string, string][],
    options: { labelWidth?: number; indent?: number } = {},
  ): void {
    const labelWidth = options.labelWidth ?? mm(38);
    const x = DIN.marginLeft + (options.indent ?? 0);
    const valueX = x + labelWidth;
    const valueWidth = DIN.marginLeft + CONTENT_WIDTH - valueX;
    for (const [key, value] of rows) {
      const lines = wrapText(value, this.font, size.body, valueWidth);
      this.ensure(leading.body * Math.max(1, lines.length));
      this.page.drawText(fitText(key, this.font, size.body, labelWidth - mm(3)), {
        x,
        y: this.y,
        size: size.body,
        font: this.font,
        color: color.muted,
      });
      lines.forEach((line, i) => {
        this.page.drawText(line, {
          x: valueX,
          y: this.y - i * leading.body,
          size: size.body,
          font: this.font,
          color: color.ink,
        });
      });
      this.y -= leading.body * Math.max(1, lines.length);
    }
  }

  /**
   * Abschnittsüberschrift mit hinterlegtem Band und Akzent in der
   * Mandantenfarbe. Ein langes Dokument braucht sichtbare Abschnitte — im
   * Übergabeprotokoll trennt sie Eckdaten, Räume, Zähler und Unterschriften.
   */
  section(title: string): void {
    const height = mm(7.5);
    this.ensure(height + mm(6));
    this.y -= mm(2);
    const top = this.y + mm(2);
    this.page.drawRectangle({
      x: DIN.marginLeft,
      y: top - height,
      width: CONTENT_WIDTH,
      height,
      color: color.panel,
    });
    this.page.drawRectangle({
      x: DIN.marginLeft,
      y: top - height,
      width: mm(1.2),
      height,
      color: this.brand,
    });
    this.page.drawText(fitText(title, this.bold, size.body, CONTENT_WIDTH - mm(10)), {
      x: DIN.marginLeft + mm(5),
      y: top - height + mm(2.3),
      size: size.body,
      font: this.bold,
      color: color.ink,
    });
    this.y = top - height - mm(5);
  }

  /**
   * Bilder in einem zweispaltigen Raster, mit Bildunterschrift.
   *
   * Jedes Bild bleibt mitsamt seiner Unterschrift auf einer Seite; eine Reihe,
   * die halb über den Blattrand ragt, dokumentiert nichts.
   */
  async photos(
    bilder: { bytes: Uint8Array; breite: number; hoehe: number; titel?: string | null }[],
    options: { spalten?: number; indent?: number; maxHoehe?: number } = {},
  ): Promise<void> {
    if (bilder.length === 0) return;
    const spalten = options.spalten ?? 2;
    // Ohne Höhendeckel füllt ein einziges Hochformat-Foto die halbe Seite: Ein
    // Handy liefert 3:4, das sind bei 80 mm Breite über 100 mm Höhe.
    const maxHoehe = options.maxHoehe ?? mm(55);
    const x0 = DIN.marginLeft + (options.indent ?? 0);
    const gesamt = DIN.marginLeft + CONTENT_WIDTH - x0;
    const steg = mm(4);
    const zellBreite = (gesamt - steg * (spalten - 1)) / spalten;

    for (let i = 0; i < bilder.length; i += spalten) {
      const reihe = bilder.slice(i, i + spalten);
      // Jedes Bild passt in seine Zelle, ohne sein Seitenverhältnis zu ändern.
      const masse = reihe.map((b) => {
        const faktor = Math.min(zellBreite / b.breite, maxHoehe / b.hoehe);
        return { breite: b.breite * faktor, hoehe: b.hoehe * faktor };
      });
      const hoehen = masse.map((m) => m.hoehe);
      const reihenHoehe = Math.max(...hoehen);
      const mitTitel = reihe.some((b) => b.titel);
      this.ensure(reihenHoehe + (mitTitel ? mm(5) : 0) + mm(4));

      const oben = this.y;
      for (let s = 0; s < reihe.length; s++) {
        const bild = reihe[s];
        const x = x0 + s * (zellBreite + steg);
        const { breite, hoehe } = masse[s];
        try {
          const eingebettet = await this.image(bild.bytes, bild.bytes);
          this.page.drawImage(eingebettet, { x, y: oben - hoehe, width: breite, height: hoehe });
        } catch {
          // Ein unlesbares Foto darf das Protokoll nicht verhindern.
          continue;
        }
        if (bild.titel) {
          this.page.drawText(fitText(bild.titel, this.font, size.foot, zellBreite), {
            x,
            y: oben - reihenHoehe - mm(3.5),
            size: size.foot,
            font: this.font,
            color: color.muted,
          });
        }
      }
      this.y = oben - reihenHoehe - (mitTitel ? mm(5) : 0) - mm(4);
    }
  }

  /**
   * Unterschriftsblock: freigestelltes Bild (sofern vorhanden), Linie, Name.
   *
   * Ohne Bild bleibt die Linie mit Platz darüber stehen — dann wird von Hand
   * unterschrieben. Eine Bescheinigung ohne Unterschriftsfeld wäre wertlos.
   */
  async signature(
    png: Uint8Array | null,
    label: string,
    options: { ort?: string | null; datum?: string | null } = {},
  ): Promise<void> {
    this.ensure(mm(40));
    if (options.ort || options.datum) {
      this.text([options.ort, options.datum].filter(Boolean).join(", den "), {
        color: color.muted,
        lead: mm(6),
      });
    }
    let drawn = false;
    if (png) {
      try {
        const image = await this.pdf.embedPng(png);
        const maxWidth = mm(60);
        const maxHeight = mm(22);
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        this.page.drawImage(image, {
          x: DIN.marginLeft,
          y: this.y - height + mm(2),
          width,
          height,
        });
        this.y -= height;
        drawn = true;
      } catch {
        /* Ein unlesbares Bild darf die Bescheinigung nicht verhindern. */
      }
    }
    if (!drawn) this.y -= mm(18);

    this.page.drawLine({
      start: { x: DIN.marginLeft, y: this.y },
      end: { x: DIN.marginLeft + mm(70), y: this.y },
      thickness: 0.7,
      color: color.muted,
    });
    this.y -= mm(5);
    this.text(label, { size: size.small, color: color.muted });
  }

  // ── Abschluss ──────────────────────────────────────────────────────────────

  /** Zeichnet die Fußzeile auf JEDE Seite und gibt das fertige PDF zurück. */
  async finish(footer: { left: string; right: string }): Promise<Buffer> {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      const y = PAGE.height - DIN.footerTop;
      page.drawLine({
        start: { x: DIN.marginLeft, y: y + mm(5) },
        end: { x: DIN.marginLeft + CONTENT_WIDTH, y: y + mm(5) },
        thickness: 0.5,
        color: color.hair,
      });
      // Der rechte Block hat Vorrang; links bekommt, was übrig bleibt.
      const right = `${footer.right}  ·  Seite ${index + 1} von ${total}`;
      const rightWidth = this.font.widthOfTextAtSize(right, size.foot);
      page.drawText(fitText(footer.left, this.font, size.foot, CONTENT_WIDTH - rightWidth - mm(6)), {
        x: DIN.marginLeft,
        y,
        size: size.foot,
        font: this.font,
        color: color.muted,
      });
      page.drawText(right, {
        x: DIN.marginLeft + CONTENT_WIDTH - rightWidth,
        y,
        size: size.foot,
        font: this.font,
        color: color.muted,
      });
    });
    return Buffer.from(await this.pdf.save());
  }
}
