// Bedienhilfe für den KI-Assistenten: kurze How-to-Texte zur Nutzung des Portals,
// nach Rolle gefiltert. Werden als zusätzliche „Quellen" in den Assistenten-Kontext
// gegeben, damit er Fragen wie „wie erstelle ich einen Beschluss?" beantworten kann.
import type { Role } from "@/generated/prisma/client";

export type HelpTopic = {
  title: string;
  roles: Role[];
  href: string;
  body: string;
};

// Reihenfolge ist unerheblich – Auswahl erfolgt über Begriffs-Treffer im Assistenten.
export const HELP_TOPICS: HelpTopic[] = [
  {
    title: "Objekt anlegen",
    roles: ["VERWALTER"],
    href: "/verwaltung/objekte/neu",
    body: `Ein neues Objekt legen Sie unter Verwaltung → Objekte → "Objekt anlegen" an. Dort erfassen Sie Bezeichnung, Adresse, Einheiten (mit Fläche, MEA und Personenzahl) sowie Eigentümer bzw. Mieter. Optional lassen sich die Daten per PDF-Import vorbefüllen.`,
  },
  {
    title: "Objekt bearbeiten",
    roles: ["VERWALTER"],
    href: "/verwaltung/objekte",
    body: `Bestehende Objekte bearbeiten Sie unter Verwaltung → Objekte: Objekt aufklappen und "Objekt bearbeiten" wählen. Die Verwaltungsart (WEG/Mietverwaltung) bleibt dabei fest.`,
  },
  {
    title: "Beschluss anlegen und abstimmen",
    roles: ["VERWALTER"],
    href: "/beschluesse",
    body: `Umlaufbeschlüsse erstellen Sie unter Beschlüsse: Titel, Beschlusstext, erforderliche Mehrheit und Frist wählen. Eigentümer stimmen im Portal ab. Nutzt ein Eigentümer die App nicht, können Sie dessen schriftliche Stimme stellvertretend eintragen (mit Nachweis). Am Ende stellen Sie das Ergebnis fest; der Beschluss wandert in die Beschluss-Sammlung.`,
  },
  {
    title: "Abstimmen an einem Beschluss",
    roles: ["EIGENTUEMER"],
    href: "/beschluesse",
    body: `Unter Beschlüsse sehen Sie laufende Abstimmungen. Wählen Sie Ja/Nein/Enthaltung und optional einen Kommentar. Bis zum Abschluss können Sie Ihre Stimme ändern.`,
  },
  {
    title: "Eigentümerversammlung und Einladung",
    roles: ["VERWALTER"],
    href: "/versammlungen",
    body: `Unter Versammlungen legen Sie eine Eigentümerversammlung an (Ort ist Pflicht). Mit dem Einladungs-Assistenten erstellen Sie die Tagesordnung (TOPs) und die Einladung als PDF; Teilnehmer und Protokoll pflegen Sie im Nachgang.`,
  },
  {
    title: "WEG-Finanzen: Buchhaltung, Wirtschaftsplan, Jahresabrechnung, Hausgeld",
    roles: ["VERWALTER"],
    href: "/verwaltung/weg",
    body: `Die WEG-Finanzen finden Sie unter Verwaltung → WEG-Finanzen, gegliedert in Stammdaten & Konten, Laufendes Jahr (Buchhaltung, Hausgeld & offene Posten, Sonderumlagen, SEPA), Planung & Abrechnung (Wirtschaftsplan, Jahresabrechnung, Betriebskosten, CO₂) sowie Pflichten & Erhaltung. Verbrauchskosten lassen sich in der Jahresabrechnung automatisch aus den Zählern verteilen.`,
  },
  {
    title: "Meine Finanzen: Jahresabrechnung und Wirtschaftsplan ansehen",
    roles: ["EIGENTUEMER"],
    href: "/finanzen",
    body: `Unter Finanzen sehen Sie Ihre Jahresabrechnung, Ihren Hausgeld-Saldo, den beschlossenen Wirtschaftsplan und die Belege der WEG. PDFs Ihrer Einzelabrechnung laden Sie dort herunter.`,
  },
  {
    title: "Antrag stellen",
    roles: ["EIGENTUEMER"],
    href: "/antraege",
    body: `Unter Anträge reichen Sie einen Beschlussantrag oder das Verlangen einer Versammlung ein. Die Verwaltung übernimmt ihn als Umlaufbeschluss/Versammlungs-TOP oder lehnt ihn begründet ab.`,
  },
  {
    title: "Vorgang / Anfrage stellen",
    roles: ["EIGENTUEMER"],
    href: "/vorgaenge/neu",
    body: `Über Vorgänge → "Anfrage stellen" melden Sie ein Anliegen an die Verwaltung und verfolgen den Status.`,
  },
  {
    title: "Vorgänge bearbeiten (Schäden/Anfragen)",
    roles: ["VERWALTER"],
    href: "/vorgaenge",
    body: `Unter Vorgänge steuern Sie Meldungen: Status, Priorität, Zuweisung an Verwalter oder Handwerker, interne Notizen und Fotos.`,
  },
  {
    title: "Zähler und Verbrauch",
    roles: ["VERWALTER", "EIGENTUEMER"],
    href: "/zaehler",
    body: `Unter Zähler erfassen Sie Zählerstände (Einzel- und Allgemeinzähler). Unter Verbrauch sehen Sie die unterjährige Verbrauchsinformation.`,
  },
  {
    title: "Dokumente und Aushänge",
    roles: ["VERWALTER", "EIGENTUEMER"],
    href: "/infos",
    body: `Dokumente und Aushänge finden Sie unter Infos. Die Verwaltung lädt Dokumente mit einer Zielgruppe hoch (Mieter, Eigentümer, Beirat oder Alle).`,
  },
  {
    title: "Wohnungsübergabe",
    roles: ["VERWALTER"],
    href: "/uebergabe",
    body: `Über Verwaltung → Wohnungsübergabe erstellen Sie ein digitales Übergabeprotokoll: Stammdaten, Räume mit Zustand und Fotos, Zählerstände, Unterschriften und PDF-Export.`,
  },
  {
    title: "Zugänge / Nutzer anlegen und einladen",
    roles: ["VERWALTER"],
    href: "/verwaltung/nutzer",
    body: `Unter Verwaltung → Nutzer legen Sie Zugänge an. Mit E-Mail wird ein Einladungslink versendet, ohne E-Mail entsteht ein druckbares Zugangsschreiben.`,
  },
  {
    title: "Verwaltungsbeirat",
    roles: ["EIGENTUEMER"],
    href: "/beirat",
    body: `Beiratsmitglieder haben einen eigenen Bereich (Beirat) mit Aufgaben/Notizen, erweiterte Einsicht in Finanzen und Dokumente und können auf Wirtschaftsplan/Jahresabrechnung einen Prüfvermerk setzen.`,
  },
];

// Bedienhilfe-Themen für die Rolle des Nutzers (Assistent nur für Verwalter/Eigentümer).
export function helpForUser(role: Role): HelpTopic[] {
  return HELP_TOPICS.filter((t) => t.roles.includes(role));
}
