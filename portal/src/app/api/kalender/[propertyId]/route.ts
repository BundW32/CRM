import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { loadRoadmap } from "@/lib/weg/roadmap";

/**
 * Der Jahresfahrplan als Kalenderdatei (.ics).
 *
 * Bewusst statt eines Kalenders im Programm: Eine kleine WEG hat rund fünfzehn
 * datierte Dinge im Jahr — ein Monatsraster wäre an den meisten Tagen leer, und
 * diese Zielgruppe öffnet das Portal zwanzig Minuten im Monat. Der Export
 * bringt die Termine dorthin, wo ohnehin täglich geschaut wird: in den eigenen
 * Kalender.
 *
 * Ganztägige Einträge (`VALUE=DATE`), weil keiner dieser Termine eine Uhrzeit
 * hat — eine erfundene Uhrzeit wäre eine Behauptung.
 */
export const dynamic = "force-dynamic";

/** Zeichen escapen, die in ICS Feldtrenner sind (RFC 5545 §3.3.11). */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Kalendertag als `JJJJMMTT` – bewusst in Europe/Berlin gerechnet, nicht in der
 * Zeitzone des Servers. Fälligkeiten stehen als Mitternacht UTC in der Datenbank;
 * auf einem Server westlich von Greenwich läge der „lokale" Tag sonst einen Tag
 * davor, und ein Termin wanderte im Kalender des Nutzers auf den Vortag.
 */
const BERLIN_TAG = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function tagFormat(d: Date): string {
  return BERLIN_TAG.format(d).replaceAll("-", "");
}

/** Der Folgetag – für `DTEND`, das bei `VALUE=DATE` exklusiv ist. */
function folgetag(d: Date): string {
  const [j, m, t] = BERLIN_TAG.format(d).split("-").map(Number);
  const naechster = new Date(Date.UTC(j, m - 1, t + 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${naechster.getUTCFullYear()}${p(naechster.getUTCMonth() + 1)}${p(naechster.getUTCDate())}`;
}

/** Erstellungszeitpunkt der Datei in UTC (RFC 5545 §3.8.7.2). */
function stempel(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Lange Zeilen falten (RFC 5545 §3.1) – sonst brechen strenge Leser ab.
 * Gefaltet wird nach Zeichen, nicht nach Oktett: Ein Umlaut darf nicht mitten
 * durchgeschnitten werden, und ein paar Oktett über der Empfehlung stören keinen
 * Kalender – ein zerrissenes Zeichen schon.
 */
function falten(zeile: string): string {
  if (zeile.length <= 75) return zeile;
  const teile: string[] = [zeile.slice(0, 75)];
  let rest = zeile.slice(75);
  while (rest.length > 74) {
    teile.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) teile.push(" " + rest);
  return teile.join("\r\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const user = await getUser();
  if (!user || user.role !== "VERWALTER") {
    return new NextResponse("Nicht berechtigt", { status: 403 });
  }
  const { propertyId } = await params;
  // Derselbe Scope-Wächter wie bei jeder schreibenden Aktion: Eine Kalenderdatei
  // ist ein Datenabzug und darf nicht an fremden Objekten vorbeikommen.
  if (!(await canVerwalterAccessProperty(user, propertyId))) {
    return new NextResponse("Nicht berechtigt", { status: 403 });
  }

  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: user.organizationId },
    select: { name: true },
  });
  if (!property) return new NextResponse("Nicht gefunden", { status: 404 });

  const items = await loadRoadmap(propertyId, new Date());
  const mitFrist = items.filter((i) => i.due !== null);

  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//B&W Kundenportal//WEG-Fahrplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`WEG-Fahrplan · ${property.name}`)}`,
  ];

  const jetzt = stempel(new Date());
  for (const item of mitFrist) {
    const due = item.due!;
    zeilen.push(
      "BEGIN:VEVENT",
      `UID:${item.key}-${tagFormat(due)}@bw-portal`,
      `DTSTAMP:${jetzt}`,
      `DTSTART;VALUE=DATE:${tagFormat(due)}`,
      `DTEND;VALUE=DATE:${folgetag(due)}`,
      `SUMMARY:${esc(item.title)}`,
      `DESCRIPTION:${esc(item.hint)}`,
      "END:VEVENT",
    );
  }
  zeilen.push("END:VCALENDAR");

  const body = zeilen.map(falten).join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="weg-fahrplan.ics"`,
      // Ein Fahrplan ist tagesaktuell – kein Zwischenspeichern.
      "Cache-Control": "no-store",
    },
  });
}
