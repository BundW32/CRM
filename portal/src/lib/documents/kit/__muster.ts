import fs from "node:fs";
import { Doc, drawLetterHead, brandColor, mm, size, color, CONTENT_WIDTH } from "@/lib/documents/kit";

async function main() {
  const doc = await Doc.create({
    title: "Mahnung Hausgeld — WE 07",
    author: "B&W Immobilien Management UG",
    subject: "Zahlungserinnerung Stufe 2",
    brand: brandColor("#00352f"),
  });
  doc.newPage();
  await drawLetterHead(doc, {
    issuer: {
      legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
      lines: ["Goethestraße 42 · 45964 Gladbeck", "verwaltung@bw-immobilien.de · 02043 123456"],
    },
    logoPath: "public/bw-logo.png",
    returnLine: "B&W Immobilien Management UG · Goethestraße 42 · 45964 Gladbeck",
    recipient: {
      note: "Einschreiben mit Rückschein",
      lines: ["Frau", "Ayşe Şahin-Grünewald", "Lindenstraße 14", "45964 Gladbeck"],
    },
    infoBlock: [["Objekt", "Lindenhof"], ["Einheit", "WE 07"], ["Datum", "Gladbeck, 28.07.2026"]],
  });
  doc.subject("Mahnung — rückständiges Hausgeld", "WEG Lindenhof — Lindenstraße 12–16 · WE 07, 2. OG rechts");
  doc.text("Sehr geehrte Frau Şahin-Grünewald,", { lead: mm(7) });
  doc.para(
    "trotz unserer Zahlungserinnerung vom 30.06.2026 besteht für Ihre Einheit WE 07 weiterhin ein " +
    "Hausgeld-Rückstand. Wir fordern Sie auf, den offenen Betrag bis spätestens 14.08.2026 auf das " +
    "unten genannte Konto der Gemeinschaft zu zahlen.",
  );
  doc.space(mm(3));
  doc.text("Offene Posten", { size: size.small, font: doc.bold, color: color.muted, lead: mm(2) });
  doc.rule({ gap: mm(2.5) });
  for (const m of ["05/2026", "06/2026", "07/2026"]) doc.amountRow(`Hausgeld ${m}`, "495,83 €");
  doc.rule({ gap: mm(2) });
  doc.amountPanel("Offener Betrag", "1.487,50 €", { sub: "Zahlbar bis 14.08.2026 · Verwendungszweck: Hausgeld WE 07" });
  doc.text("Bankverbindung der Gemeinschaft", { size: size.small, font: doc.bold, color: color.muted, lead: mm(5) });
  doc.defList([["Kontoinhaber", "WEG Lindenhof"], ["IBAN", "DE02 4265 0150 0000 1234 56"], ["Verwendungszweck", "Hausgeld WE 07"]]);
  doc.space(mm(4));
  doc.para("Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.");
  doc.space(mm(4));
  doc.text("Mit freundlichen Grüßen", { lead: mm(11) });
  doc.para("B&W Immobilien Management UG (haftungsbeschränkt)", { width: CONTENT_WIDTH });
  doc.text("Hausverwaltung", { size: size.small, color: color.muted });

  const bytes = await doc.finish({
    left: "B&W Immobilien Management UG · Amtsgericht Gelsenkirchen HRB 12345",
    right: "Erstellt am 28.07.2026",
  });
  fs.writeFileSync("/tmp/claude-0/-home-user-CRM/856bd9fb-1cf0-5d48-9702-ab768b08b829/scratchpad/Kit_Muster.pdf", bytes);
  console.log("geschrieben:", bytes.byteLength, "Bytes");
}
main();
