// Der WEG-Jahresfahrplan: was ist jetzt dran?
//
// Eine eingerichtete WEG sah bisher elf gleichwertige Schaltflächen und musste
// selbst wissen, welche davon gerade zählt. Das Wissen dafür steckt vollständig
// in den Daten – es wurde nur nirgends zusammengeführt.
//
// Reine Ableitung ohne eigene Tabelle: Der Fahrplan ist immer der aktuelle
// Zustand, nie ein Abbild davon.

import { db } from "@/lib/db";
import { classifyDue, type DueStatus } from "./compliance";
import { ersterFehlenderSollmonat } from "./due-postings";
import { oposJeEinheit } from "./opos-service";

export type RoadmapItem = {
  key: string;
  title: string;
  /** Was zu tun ist, in der Sprache eines Eigentümers. */
  hint: string;
  href: string;
  /** Stichtag, an dem die Aufgabe erledigt sein sollte (null = ohne Frist). */
  due: Date | null;
  status: DueStatus;
  /** Kurzform der Frist für die Anzeige. */
  dueLabel: string;
  /**
   * Steht unabhängig von jeder Frist ganz oben. Für die eine Aufgabe, ohne die
   * der laufende Betrieb nicht beginnt: den allerersten Wirtschaftsplan. Ohne
   * ihn gibt es kein Hausgeld, ohne Hausgeld keine offenen Posten und nichts
   * abzurechnen – ein Stichtag „31.12." würde das ans Ende sortieren und damit
   * das Gegenteil dessen aussagen, was gilt.
   */
  vorrang?: boolean;
};

const MONAT = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/**
 * Aufgaben des laufenden WEG-Jahres, nach Fälligkeit sortiert.
 *
 * Die Fristen sind bewusst konservativ gesetzt und als *Richtwerte* benannt,
 * nicht als gesetzliche Stichtage: Das WEG-Gesetz nennt für die Jahresabrechnung
 * keine Frist auf den Tag („nach Ablauf des Kalenderjahres“), und der
 * Wirtschaftsplan soll vor Beginn des Jahres stehen, das er plant. Wer hier
 * härtere Daten behauptet, erfindet Recht.
 */
export async function loadRoadmap(propertyId: string, now: Date = new Date()): Promise<RoadmapItem[]> {
  const jahr = now.getFullYear();
  const weg = `/verwaltung/weg/${propertyId}`;

  const [planKommend, planIrgendeiner, abrechnungVorjahr, versammlungImJahr, pruefpflichten, rueckstaende, fehlenderSollmonat] =
    await Promise.all([
      db.economicPlan.findFirst({
        where: { propertyId, year: jahr + 1, status: "BESCHLOSSEN" },
        select: { id: true },
      }),
      // Gab es überhaupt je einen beschlossenen Plan? Entscheidet zwischen
      // „erster Plan fehlt" (dringend) und „Plan fürs nächste Jahr steht aus".
      db.economicPlan.findFirst({
        where: { propertyId, status: "BESCHLOSSEN" },
        select: { id: true },
      }),
      db.annualStatement.findFirst({
        where: { propertyId, year: jahr - 1, status: "FERTIG" },
        select: { id: true },
      }),
      db.ownersMeeting.findFirst({
        where: {
          propertyId,
          scheduledAt: { gte: new Date(jahr, 0, 1), lt: new Date(jahr + 1, 0, 1) },
        },
        select: { id: true },
      }),
      // Alle aktiven Aufgaben, nicht nur die aus dem Prüfpflichten-Katalog:
      // Eigene Termine der Gemeinschaft — einmalig wie wiederkehrend — laufen
      // über dasselbe Modell und gehören in denselben Fahrplan. `catalogKey`
      // unterscheidet nur noch die Herkunft für den Hinweistext.
      db.maintenanceTask.findMany({
        where: { propertyId, active: true },
        orderBy: { dueDate: "asc" },
        select: { id: true, title: true, dueDate: true, catalogKey: true, interval: true },
      }),
      // Rückstand je Forderung, nicht als Differenz zweier Summen: Sonst tilgte
      // die Zahlung einer Sonderumlage Hausgeldrückstände und eine
      // Vorauszahlung verdeckte einen offenen Monat (siehe payment-allocation.ts).
      oposJeEinheit(propertyId, now),
      // Fortgeltung (§ 28 Abs. 1 Satz 2 WEG): Gibt es Monate, für die schon
      // Forderungen bestehen müssten, aber keine da sind?
      ersterFehlenderSollmonat(propertyId, now),
    ]);

  const offenCents = [...rueckstaende.values()].reduce((s, z) => s + z.gesamtCents, 0);

  const items: RoadmapItem[] = [];

  // ── Der allererste Wirtschaftsplan ─────────────────────────────────────────
  // Stand früher als neunter Schritt in der Einrichtung. Dort war er falsch: Die
  // Einrichtung erfasst Stammdaten und ist dann fertig, der Plan wiederholt sich
  // jedes Jahr. Er ist der Übergang von der Einrichtung in den Betrieb – und
  // deshalb der erste Punkt hier, ohne Frist, aber mit Vorrang.
  if (!planIrgendeiner) {
    items.push({
      key: "erster-plan",
      title: "Ersten Wirtschaftsplan aufstellen und beschließen",
      hint:
        "Der Plan legt das Hausgeld je Einheit fest (§ 28 Abs. 1 WEG). Erst sein Beschluss " +
        "macht daraus Forderungen – vorher gibt es nichts einzuziehen und nichts abzurechnen.",
      href: `${weg}/wirtschaftsplan`,
      due: null,
      status: "soon",
      dueLabel: "steht noch aus",
      vorrang: true,
    });
  }

  // ── Jahresabrechnung fürs Vorjahr ──────────────────────────────────────────
  if (!abrechnungVorjahr) {
    // Richtwert: bis Ende Juni des Folgejahres. Das ist die gängige Praxis, kein
    // gesetzlicher Stichtag – § 28 Abs. 2 WEG nennt keinen Tag.
    items.push(
      mitFrist({
        key: "abrechnung",
        title: `Jahresabrechnung ${jahr - 1} erstellen`,
        hint: "Was im vergangenen Jahr tatsächlich angefallen ist, auf die Einheiten verteilt. Die Gemeinschaft beschließt sie in der Versammlung.",
        href: `${weg}/jahresabrechnung`,
        due: new Date(jahr, 5, 30),
      }, now),
    );
  }

  // ── Versammlung ────────────────────────────────────────────────────────────
  if (!versammlungImJahr) {
    // § 24 Abs. 1 WEG: mindestens einmal jährlich. Richtwert Jahresende.
    items.push(
      mitFrist({
        key: "versammlung",
        title: `Eigentümerversammlung ${jahr} einberufen`,
        hint: "Mindestens einmal im Jahr (§ 24 Abs. 1 WEG). Ladefrist drei Wochen – der Assistent rechnet das späteste Versanddatum aus.",
        href: "/versammlungen",
        due: new Date(jahr, 11, 31),
      }, now),
    );
  }

  // ── Wirtschaftsplan fürs kommende Jahr ─────────────────────────────────────
  // Nur, wenn es schon einen gibt – sonst stünde der Punkt doppelt da, einmal
  // als „erster Plan" und einmal als Fortschreibung.
  if (planIrgendeiner && !planKommend) {
    // Soll vor Beginn des Jahres stehen, das er plant.
    items.push(
      mitFrist({
        key: "wirtschaftsplan",
        title: `Wirtschaftsplan ${jahr + 1} beschließen`,
        hint: `Legt das Hausgeld ab ${MONAT[0]} ${jahr + 1} fest. Der Beschluss erzeugt die monatlichen Forderungen automatisch.`,
        href: `${weg}/wirtschaftsplan`,
        due: new Date(jahr, 11, 31),
      }, now),
    );
  }

  // ── Fehlende Sollstellungen (Fortgeltung) ──────────────────────────────────
  // Der stillste aller Fehler: Es fehlt nichts Sichtbares, es entstehen nur
  // keine Forderungen mehr. Ohne diesen Hinweis fällt es erst auf, wenn das
  // Geld ausbleibt — und dann ist ein Quartal weg.
  if (fehlenderSollmonat) {
    items.push({
      key: "sollstellungen",
      title: "Hausgeld-Forderungen fehlen",
      hint:
        `Seit ${MONAT[fehlenderSollmonat.month - 1]} ${fehlenderSollmonat.year} sind keine Forderungen mehr entstanden. ` +
        "Der zuletzt beschlossene Wirtschaftsplan gilt fort, bis ein neuer beschlossen ist " +
        "(§ 28 Abs. 1 Satz 2 WEG) — die Forderungen lassen sich mit einem Klick nachziehen.",
      href: `${weg}/hausgeld`,
      due: null,
      status: "overdue",
      dueLabel: `ab ${MONAT[fehlenderSollmonat.month - 1]} ${fehlenderSollmonat.year}`,
      vorrang: true,
    });
  }

  // ── Fällige Prüfpflichten und eigene Termine ───────────────────────────────
  for (const p of pruefpflichten) {
    if (!p.dueDate) continue;
    const { status } = classifyDue(p.dueDate, now, 30);
    if (status === "ok") continue;
    const ausKatalog = p.catalogKey !== null;
    items.push(
      mitFrist({
        key: `pflicht-${p.id}`,
        title: p.title,
        hint: ausKatalog
          ? "Wiederkehrende Prüfpflicht. Wird sie versäumt, haftet die Gemeinschaft – nicht der Dienstleister."
          : p.interval === "EINMALIG"
            ? "Eigener Termin der Gemeinschaft."
            : "Eigene wiederkehrende Aufgabe der Gemeinschaft.",
        href: `${weg}/pruefpflichten`,
        due: p.dueDate,
      }, now),
    );
  }

  // ── Offene Hausgeld-Rückstände ─────────────────────────────────────────────
  if (offenCents > 0) {
    items.push({
      key: "rueckstaende",
      title: "Hausgeld-Rückstände offen",
      hint: "Fällige Forderungen, denen noch keine Zahlung zugeordnet ist. Entweder fehlt die Zuordnung – oder das Geld.",
      href: `${weg}/hausgeld`,
      due: null,
      status: "soon",
      dueLabel: `${(offenCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} offen`,
    });
  }

  return sortiere(items);
}

/** Ein Fahrplan-Eintrag mit dem Objekt, zu dem er gehört. */
export type RoadmapEintrag = RoadmapItem & { propertyId: string; propertyName: string };

/**
 * Der Fahrplan über **alle** Objekte einer Gemeinschaft, in einer Liste.
 *
 * Vorher lief das über `propIds[0]` — das erste Objekt in beliebiger
 * Datenbankreihenfolge. Eine WEG mit Wohnhaus und Tiefgarage als eigenem
 * Grundbuch sah damit die Fristen nur eines der beiden, und nicht verlässlich
 * desselben. Der stillste Ausgang davon: Eine Frist läuft ab, und im Programm
 * stand nie etwas davon.
 *
 * Zusammengefasst statt umschaltbar: Eine Frist, die man erst nach einem Klick
 * sieht, ist keine Frist. Das Objekt steht am Eintrag, wenn es mehrere gibt.
 */
export async function loadRoadmapAlle(
  properties: readonly { id: string; name: string }[],
  now: Date = new Date(),
): Promise<RoadmapEintrag[]> {
  const listen = await Promise.all(properties.map((p) => loadRoadmap(p.id, now)));
  return mischeFahrplaene(properties, listen);
}

/**
 * Der reine Teil von `loadRoadmapAlle` – ohne Datenbank und damit prüfbar.
 *
 * Zwei Dinge müssen hier stimmen, und beide fallen sonst erst in der
 * Oberfläche auf: Die Schlüssel müssen über Objektgrenzen hinweg eindeutig
 * bleiben (`abrechnung` gibt es sonst mehrfach, und React verliert die
 * Zuordnung der Zeilen), und die Dringlichkeit muss über **alle** Objekte
 * hinweg sortieren – nicht objektweise hintereinander.
 */
export function mischeFahrplaene(
  properties: readonly { id: string; name: string }[],
  listen: readonly RoadmapItem[][],
): RoadmapEintrag[] {
  const alle = listen.flatMap((items, i) =>
    items.map((item) => ({
      ...item,
      key: `${properties[i].id}:${item.key}`,
      propertyId: properties[i].id,
      propertyName: properties[i].name,
    })),
  );
  return sortiere(alle);
}

/** Vorrang zuerst, dann nach Stichtag; Fristloses ans Ende. */
function sortiere<T extends RoadmapItem>(items: T[]): T[] {
  return items.sort((a, b) => {
    if (a.vorrang !== b.vorrang) return a.vorrang ? -1 : 1;
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.getTime() - b.due.getTime();
  });
}

function mitFrist(
  item: Omit<RoadmapItem, "status" | "dueLabel"> & { due: Date },
  now: Date,
): RoadmapItem {
  const { days, status } = classifyDue(item.due, now, 60);
  const label =
    days < 0
      ? `seit ${Math.abs(days)} Tagen überfällig`
      : days === 0
        ? "heute fällig"
        : days <= 60
          ? `in ${days} Tagen`
          : `bis ${item.due.toLocaleDateString("de-DE", { day: "2-digit", month: "long" })}`;
  return { ...item, status, dueLabel: label };
}
