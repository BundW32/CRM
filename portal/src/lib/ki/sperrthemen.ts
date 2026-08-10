// Sperrliste des Assistenten (Konzept 3.5): Themen, bei denen der Assistent
// nicht antworten DARF, sondern hart ablehnt und auf die zuständige Person
// verweist. Die Prüfung läuft VOR jedem Modellaufruf — eine Regel im Prompt
// wäre nur eine Bitte, dieser Code ist eine Zusage.
//
// Bewusst eng geschnitten: Gesperrt ist die ENTSCHEIDUNG („Soll ich Frau X
// mahnen?", „Ist der Beschluss gültig?"), nicht die Wissensfrage („Was ist
// eine Mahnung?", „Welche Beschlüsse wurden gefasst?"). Eine zu breite Sperre
// würde genau die Erklär-Fragen abwürgen, für die der Assistent da ist — die
// Negativfälle stehen deshalb ausdrücklich im Test.

export type Sperrthema = {
  thema: "bonitaet" | "mahnentscheidung" | "beschlussfeststellung" | "rechtevergabe";
  antwort: string;
};

const HINWEIS_MAHNUNG =
  "Ob und wann gemahnt wird, entscheidet die Verwaltung nach dem vereinbarten " +
  "Verfahren — nicht der Assistent. Den Stand der Zahlungen und offene Posten " +
  "finden Sie unter Hausgeld; das weitere Vorgehen legt die Verwaltung bzw. der " +
  "Verwaltungsbeirat fest.";

const HINWEIS_BONITAET =
  "Zur Zahlungsfähigkeit oder Bonität einzelner Personen macht der Assistent " +
  "grundsätzlich keine Aussagen. Offene Posten sehen Berechtigte unter Hausgeld; " +
  "alles Weitere gehört in die Hände der Verwaltung.";

const HINWEIS_BESCHLUSS =
  "Ob ein Beschluss zustande gekommen oder gültig ist, stellt die Versammlungs" +
  "leitung fest bzw. klärt im Streitfall ein Gericht — der Assistent trifft diese " +
  "Feststellung nicht. Er kann Ihnen aber das Verfahren erklären und den " +
  "dokumentierten Wortlaut samt Abstimmungsergebnis aus der Beschluss-Sammlung nennen.";

const HINWEIS_RECHTE =
  "Rollen und Berechtigungen vergibt der Assistent nicht. Zuständig ist die " +
  "Verwaltung bzw. der Administrator Ihrer Organisation (Verwaltung → Benutzer).";

type Regel = { thema: Sperrthema["thema"]; muster: RegExp[]; antwort: string };

// Entscheidungs-Verben, die aus einer Wissensfrage eine Handlungs-/
// Bewertungsfrage machen. „Kann ich …" fehlt bewusst: „Kann ich meine
// Mahnung im Portal sehen?" ist eine legitime Bedienfrage.
const ENTSCHEIDUNG = "(?:soll(?:en|te|ten)?|empfiehl\\w*|empfehlen|würdest|müssen wir|muss ich)";

const REGELN: Regel[] = [
  {
    thema: "bonitaet",
    muster: [
      /\bbonität\w*/i,
      /\bkreditwürdig\w*/i,
      /\bsolven[tz]\w*/i,
      /\bzahlungs(?:fähig|unfähig)\w*/i,
    ],
    antwort: HINWEIS_BONITAET,
  },
  {
    thema: "mahnentscheidung",
    muster: [
      new RegExp(`\\b${ENTSCHEIDUNG}\\b[^.?!]{0,80}\\b(?:mahn|gemahnt|kündig)`, "i"),
      /\bmahnstufe\w*\b[^.?!]{0,60}\b(?:setz\w*|erhöh\w*|einleit\w*|entscheid\w*|wähl\w*)/i,
      /\b(?:wen|welche eigentümer)\b[^.?!]{0,60}\bmahnen\b/i,
    ],
    antwort: HINWEIS_MAHNUNG,
  },
  {
    thema: "beschlussfeststellung",
    muster: [
      // [^?!] statt [^.?!]: In „Beschluss vom 12.03." stünde sonst der
      // Datumspunkt zwischen Stichwort und Prädikat und das Muster griffe nie.
      /\bbeschluss\w*\b[^?!]{0,80}\b(?:gültig|ungültig|wirksam|unwirksam|nichtig|anfechtbar|zustande\s*gekommen|angenommen oder abgelehnt)\b/i,
      /\b(?:stell\w*|verkünde\w*)\b[^?!]{0,60}\bbeschluss/i,
      /\bbeschluss\w*\b[^?!]{0,60}\b(?:feststell\w*|festgestellt|verkünd\w*)/i,
    ],
    antwort: HINWEIS_BESCHLUSS,
  },
  {
    thema: "rechtevergabe",
    // Vor „ändere"/„ändern" steht bewusst KEIN \b: JavaScripts \b kennt nur
    // ASCII-Wortzeichen und findet vor einem Umlaut nie eine Wortgrenze.
    muster: [
      /(?:\bgib|\bgebe|\bmach\w*|ändere?|\bsetze?|\bentzieh\w*|\bschalte)\b[^.?!]{0,60}\b(?:rolle|rechte|berechtigung\w*|admin\w*|zugriff)\b/i,
      /\b(?:rolle|rechte|berechtigung\w*|admin\w*|zugriff)\b[^.?!]{0,60}(?:\bvergeben|ändern|\bgeben|\beinräum\w*|\bentziehen|\bfreischalten)\b/i,
    ],
    antwort: HINWEIS_RECHTE,
  },
];

/**
 * Prüft eine Nutzerfrage gegen die Sperrliste. Liefert das getroffene Thema
 * samt fest verdrahteter Antwort — oder null, wenn die Frage durchgeht.
 */
export function sperrthema(frage: string): Sperrthema | null {
  const f = frage.trim();
  if (!f) return null;
  for (const regel of REGELN) {
    if (regel.muster.some((m) => m.test(f))) {
      return { thema: regel.thema, antwort: regel.antwort };
    }
  }
  return null;
}
