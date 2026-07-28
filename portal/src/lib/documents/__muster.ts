import fs from "node:fs";
import path from "node:path";
import { generateMahnung } from "./mahnung";
import { brandColor } from "./kit";

const OUT = "/tmp/claude-0/-home-user-CRM/856bd9fb-1cf0-5d48-9702-ab768b08b829/scratchpad";
const issuer = {
  legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
  lines: ["Goethestraße 42 · 45964 Gladbeck", "verwaltung@bw-immobilien.de", "+49 151 29468127"],
};
const logoPath = path.join(process.cwd(), "public", "bw-logo.png");

async function main() {
  const stufe1 = await generateMahnung({
    issuer, logoPath, brand: brandColor("#00352f"),
    propertyName: "WEG Lindenhof, Lindenstraße 12–16", unitLabel: "WE 07",
    level: 1,
    recipient: { name: "Ayşe Şahin-Grünewald", salutation: "Frau", lastName: "Şahin-Grünewald" },
    recipientAddress: "Lindenstraße 14\n45964 Gladbeck",
    arrearsCents: 49583,
    positions: [{ label: "Hausgeld 07/2026", cents: 49583 }],
    paymentDeadline: new Date(2026, 7, 14),
    iban: "DE02 4265 0150 0000 1234 56", accountHolder: "WEG Lindenhof",
    createdAt: new Date(2026, 6, 28), city: "Gladbeck", vorgang: "MA-2026-0148",
  });
  fs.writeFileSync(`${OUT}/Mahnung_Stufe1.pdf`, stufe1);

  const stufe3 = await generateMahnung({
    issuer, logoPath, brand: brandColor("#00352f"),
    propertyName: "WEG Lindenhof-Nord, Lindenstraße 12–16 und Rosenweg 3a–3f, 45964 Gladbeck-Zweckel",
    unitLabel: "WE 07, 2. Obergeschoss rechts, nebst Kellerraum K7",
    level: 3,
    recipient: { name: "Jonas Müller", salutation: "Herr", lastName: "Müller" },
    recipientAddress: "Lindenstraße 14, Hinterhaus\n45964 Gladbeck-Zweckel",
    versandVermerk: "Einschreiben mit Rückschein",
    arrearsCents: 1487500,
    positions: Array.from({ length: 14 }, (_, i) => ({
      label: `Hausgeld ${String((i % 12) + 1).padStart(2, "0")}/${2025 + Math.floor(i / 12)}`,
      cents: 49583,
    })),
    paymentDeadline: new Date(2026, 7, 14),
    previousReminderAt: new Date(2026, 5, 30),
    iban: "DE02 4265 0150 0000 1234 56", accountHolder: "WEG Lindenhof-Nord",
    createdAt: new Date(2026, 6, 28), city: "Gladbeck", vorgang: "MA-2026-0151",
  });
  fs.writeFileSync(`${OUT}/Mahnung_Stufe3.pdf`, stufe3);
  console.log("geschrieben");
}
main();
