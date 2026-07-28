// Oberflächen-Regeln: Bausteine benutzen statt nachbauen.
//
// Ohne diese Regeln wächst die Uneinheitlichkeit einfach nach. Gezählt vor dem
// Aufräumen: 26 rohe Datumsfelder (sieben davon ohne `inputClass`, dort sah der
// Kalender sichtbar anders aus), 45 handgebaute Karten neben 140 `Card` und
// 61 selbstgeschriebene Etiketten.
//
// Die Regeln sind **eng** geschnitten und treffen nur den offensichtlichen
// Nachbau. Das ist Absicht: Eine Regel, die auch Aufklapp-Menüs und Dialoge
// anmeckert, wird reihenweise abgeschaltet – und ist dann weniger wert als gar
// keine. Was sie nicht erwischt, fängt die Durchsicht ab.
//
// Grenze der Technik: Getroffen werden nur Klassen, die als Zeichenkette
// dastehen. Wer `className={`… ${x}`}` schreibt, entzieht sich der Prüfung.

const KEIN_ROHES_DATUM =
  "Rohes <input type=\"date\">. Bitte `DateField` aus @/components/fields " +
  "verwenden – sonst sieht der Kalender auf dieser Seite anders aus als auf der " +
  "nächsten. Für Werte aus der Datenbank: `toDateInputValue`.";

const KEINE_HANDKARTE =
  "Das ist eine nachgebaute `Card`. Bitte `Card` aus @/components/ui verwenden " +
  "(bzw. `CollapsibleCard`), damit Radius, Rahmen und Schatten an einer Stelle " +
  "gepflegt werden.";

const KEIN_HANDETIKETT =
  "Das ist ein nachgebautes `Badge`. Bitte `Badge` aus @/components/data-display " +
  "mit einem der semantischen Töne verwenden (neutral/success/warning/danger/" +
  "info/accent) statt eigener Farben.";

/**
 * Erzeugt einen esquery-Selektor auf ein `className`-Literal, dessen Wert alle
 * genannten Bruchstücke enthält – Reihenfolge egal (Tailwind-Klassen stehen in
 * beliebiger Folge). Die Lookaheads erledigen das, ein einfaches Aneinanderreihen
 * würde eine feste Reihenfolge verlangen und fast nie greifen.
 */
function className(...teile) {
  const muster = teile.map((t) => `(?=.*${t})`).join("");
  return `JSXAttribute[name.name="className"] > Literal[value=/^${muster}/]`;
}

export const oberflaecheRegeln = {
  files: ["src/**/*.tsx"],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector:
          'JSXOpeningElement[name.name="input"] > JSXAttribute[name.name="type"] > Literal[value="date"]',
        message: KEIN_ROHES_DATUM,
      },
      {
        // Die Signatur von `Card` selbst – wer sie abschreibt, will eine Karte.
        // Aufklapp-Menüs und Dialoge tragen andere Schatten und Rahmenfarben und
        // fallen deshalb nicht darunter.
        selector: className(
          "\\brounded-2xl\\b",
          "\\bborder-gray-200\\b",
          "\\bbg-white\\b",
          "\\bshadow-sm\\b",
        ),
        message: KEINE_HANDKARTE,
      },
      {
        // Die Signatur von `Badge`: runde Pille, kleine Schrift, halbfett.
        // Zähler-Kreise und Auswahl-Chips haben kein `py-0.5` und bleiben außen vor.
        selector: className(
          "\\brounded-full\\b",
          "\\bpy-0\\.5\\b",
          "\\btext-xs\\b",
          "\\bfont-(medium|semibold)\\b",
        ),
        message: KEIN_HANDETIKETT,
      },
    ],
  },
};

/**
 * Ausnahmeliste für den Bestand.
 *
 * Diese Dateien verstoßen heute gegen die Regeln oben. Sie werden in Wellen
 * umgestellt (siehe `docs/PLAN-Design-Vereinheitlichung.md`, Stufe 4); bis dahin
 * dürfen sie nicht den Build brechen.
 *
 * **Die Liste wird nur kürzer, nie länger.** Wer eine Datei umstellt, streicht
 * sie hier. Wer eine neue Datei einträgt, umgeht die Regel – dann lieber den
 * Baustein benutzen.
 */
export const oberflaecheBaustein = {
  // `DateField` selbst muss ein rohes `<input type="date">` enthalten – es ist
  // der Baustein, den alle anderen benutzen sollen. Dauerhafte Ausnahme.
  files: ["src/components/fields.tsx"],
  rules: { "no-restricted-syntax": "off" },
};

export const oberflaecheBestand = {
  files: [
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/buchhaltung/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/co2/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/erhaltungsplanung/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/hausgeld/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/lastschrift/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/pruefpflichten/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/sonderumlagen/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/stammdaten/page.tsx",
    "src/app/(portal)/verwaltung/weg/\\[propertyId\\]/wirtschaftsplan/\\[planId\\]/page.tsx",
    "src/app/auftraege/\\[token\\]/page.tsx",
    "src/app/plattform/organisationen/\\[id\\]/page.tsx",
    "src/app/plattform/organisationen/page.tsx",
    "src/app/plattform/page.tsx",
    "src/app/plattform/rechnungen/neu/page.tsx",
    "src/app/plattform/rechnungen/page.tsx",
    "src/app/uebergabe/\\[id\\]/abschluss/page.tsx",
    "src/app/uebergabe/\\[id\\]/checkliste/ChecklisteForm.tsx",
    "src/app/uebergabe/\\[id\\]/raeume/RaeumeClient.tsx",
    "src/app/uebergabe/\\[id\\]/stammdaten/StammdatenForm.tsx",
    "src/app/uebergabe/\\[id\\]/unterschriften/SignatureSection.tsx",
    "src/app/uebergabe/\\[id\\]/unterschriften/page.tsx",
    "src/app/uebergabe/\\[id\\]/zaehler/ZaehlerClient.tsx",
    "src/app/uebergabe/_components/StepHeader.tsx",
    "src/app/uebergabe/neu/page.tsx",
    "src/app/uebergabe/page.tsx",
  ],
  rules: { "no-restricted-syntax": "off" },
};
