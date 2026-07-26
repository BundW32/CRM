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

  const [planKommend, abrechnungVorjahr, versammlungImJahr, pruefpflichten, rueckstaende] =
    await Promise.all([
      db.economicPlan.findFirst({
        where: { propertyId, year: jahr + 1, status: "BESCHLOSSEN" },
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
      db.maintenanceTask.findMany({
        where: { propertyId, active: true, catalogKey: { not: null } },
        orderBy: { dueDate: "asc" },
        select: { id: true, title: true, dueDate: true },
      }),
      // Rückstand = fällige Sollstellungen minus zugeordnete Zahlungseingänge.
      db.duePosting.aggregate({
        where: { propertyId, dueDate: { lte: now } },
        _sum: { amountCents: true },
      }),
    ]);

  const gezahlt = await db.booking.aggregate({
    where: { propertyId, kind: "EINNAHME", unitId: { not: null } },
    _sum: { amountCents: true },
  });
  const offenCents = (rueckstaende._sum.amountCents ?? 0) - (gezahlt._sum.amountCents ?? 0);

  const items: RoadmapItem[] = [];

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
  if (!planKommend) {
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

  // ── Fällige Prüfpflichten ──────────────────────────────────────────────────
  for (const p of pruefpflichten) {
    if (!p.dueDate) continue;
    const { status } = classifyDue(p.dueDate, now, 30);
    if (status === "ok") continue;
    items.push(
      mitFrist({
        key: `pflicht-${p.id}`,
        title: p.title,
        hint: "Wiederkehrende Prüfpflicht. Wird sie versäumt, haftet die Gemeinschaft – nicht der Dienstleister.",
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

  // Überfälliges zuerst, danach nach Stichtag; Fristloses ans Ende.
  return items.sort((a, b) => {
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
