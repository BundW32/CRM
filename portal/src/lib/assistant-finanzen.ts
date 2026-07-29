// Finanzwissen für den Assistenten: Kontostände, Rückstände, Stand des
// Jahreslaufs.
//
// **Warum das fehlte.** Der Assistent kannte Beschlüsse, Aushänge, Vorgänge und
// Versammlungen — aber kein Geld. Auf „Wie viel haben wir auf dem Konto?" oder
// „Bin ich mit dem Hausgeld im Rückstand?" antwortete er „Dazu finde ich in
// Ihren Unterlagen nichts". Das sind aber genau die Fragen, die ein
// selbstverwaltender Eigentümer stellt.
//
// **Die eine Entscheidung, auf die es hier ankommt.**
//
// Ein Assistent, der Nachbardaten ausplaudert, ist ein Datenschutzvorfall — und
// zwar einer, der sich nicht zurücknehmen lässt, weil die Auskunft schon
// erteilt ist. Die Grenze verläuft deshalb **nicht** entlang der Rolle allein,
// sondern entlang dessen, was der Fragende ohnehin schon sehen darf:
//
// - **Kontostände und Rücklage** sieht jeder Eigentümer. Sie stehen im
//   Vermögensbericht (§ 28 Abs. 4 WEG), den die Gemeinschaft ohnehin bekommt.
// - **Die Summe der Rückstände** sieht jeder Eigentümer. Auch sie steht dort,
//   als „Forderungen gegen Eigentümer".
// - **Wer** im Rückstand ist, sieht **nur die Verwaltung**. Das steht in keinem
//   Bericht, den alle bekommen, und geht den Nachbarn nichts an.
// - **Den eigenen Rückstand** sieht der Eigentümer selbst — über seine Einheiten.
//
// Diese Grenze steht hier in einer Funktion und wird in
// `assistant-finanzen.test.ts` gegen die Rolle geprüft. Sie im Prompt zu
// formulieren wäre der falsche Ort: Ein Sprachmodell ist keine Zugriffskontrolle.

import type { User } from "@/generated/prisma/client";
import { ownedProperties, ownedUnitIdsInProperty, propertyIdsForVerwalter } from "./access";
import { db } from "./db";
import { formatCents } from "./money";
import { vorzeichenBetrag } from "./weg/journal";
import { oposJeEinheit } from "./weg/opos-service";

export type FinanzQuelle = {
  type: string;
  title: string;
  href: string;
  snippet: string;
};

/** Objekte, über deren Finanzen dieser Nutzer Auskunft bekommen darf. */
async function wegObjekteFuer(
  user: User,
): Promise<{ id: string; name: string }[]> {
  if (user.role === "VERWALTER") {
    const ids = await propertyIdsForVerwalter(user);
    return db.property.findMany({
      where: {
        managementType: "WEG",
        organizationId: user.organizationId,
        ...(ids === null ? {} : { id: { in: ids } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  if (user.role === "EIGENTUEMER") {
    const props = await ownedProperties(user.id);
    return props
      .filter((p) => p.managementType === "WEG" && p.organizationId === user.organizationId)
      .map((p) => ({ id: p.id, name: p.name }));
  }
  // Mieter und Handwerker haben mit den Finanzen der Gemeinschaft nichts zu tun.
  return [];
}

/** Kontostand eines Objekts je Kontoart, aus Eröffnungssaldo und Buchungen. */
async function kontostaende(propertyId: string) {
  const konten = await db.ledgerAccount.findMany({
    where: { propertyId, active: true },
    select: { id: true, name: true, kind: true, openingBalanceCents: true },
  });
  if (konten.length === 0) return [];
  const buchungen = await db.booking.findMany({
    where: { accountId: { in: konten.map((k) => k.id) } },
    select: { accountId: true, kind: true, transferOut: true, amountCents: true },
  });
  return konten.map((k) => ({
    ...k,
    saldoCents:
      k.openingBalanceCents +
      buchungen
        .filter((b) => b.accountId === k.id)
        .reduce((s, b) => s + vorzeichenBetrag(b), 0),
  }));
}

export async function finanzQuellen(user: User): Promise<FinanzQuelle[]> {
  const objekte = await wegObjekteFuer(user);
  if (objekte.length === 0) return [];

  const quellen: FinanzQuelle[] = [];
  const istVerwalter = user.role === "VERWALTER";

  for (const objekt of objekte) {
    // ── Kontostände ────────────────────────────────────────────────────────
    const konten = await kontostaende(objekt.id);
    if (konten.length > 0) {
      const giro = konten.filter((k) => k.kind === "GIRO");
      const ruecklage = konten.filter((k) => k.kind === "RUECKLAGE");
      const summe = (ks: typeof konten) => ks.reduce((s, k) => s + k.saldoCents, 0);
      quellen.push({
        type: "Kontostand",
        title: `Kontostände ${objekt.name}`,
        href: istVerwalter ? `/verwaltung/weg/${objekt.id}` : "/finanzen",
        snippet:
          `Laufendes Konto (Geld für die laufenden Kosten): ${formatCents(summe(giro))}. ` +
          `Erhaltungsrücklage (das Gesparte für große Reparaturen): ${formatCents(summe(ruecklage))}. ` +
          `Einzelne Konten: ${konten.map((k) => `${k.name} ${formatCents(k.saldoCents)}`).join(", ")}.`,
      });
    }

    // ── Rückstände ─────────────────────────────────────────────────────────
    const opos = await oposJeEinheit(objekt.id);
    const einheiten = await db.unit.findMany({
      where: { propertyId: objekt.id },
      select: { id: true, label: true },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    });
    const rueckstaendig = einheiten.filter((e) => (opos.get(e.id)?.gesamtCents ?? 0) > 0);
    const gesamtCents = einheiten.reduce((s, e) => s + (opos.get(e.id)?.gesamtCents ?? 0), 0);

    // Die Summe darf jeder sehen — sie steht so im Vermögensbericht.
    quellen.push({
      type: "Rückstände",
      title: `Hausgeld-Rückstände ${objekt.name}`,
      href: istVerwalter ? `/verwaltung/weg/${objekt.id}/hausgeld` : "/finanzen",
      snippet:
        gesamtCents === 0
          ? `Zurzeit sind keine Hausgeld-Rückstände offen.`
          : `Insgesamt ${formatCents(gesamtCents)} offen, verteilt auf ${rueckstaendig.length} ` +
            `${rueckstaendig.length === 1 ? "Einheit" : "Einheiten"}.` +
            // Namen und Einheiten nur für die Verwaltung: Wer säumig ist, steht
            // in keinem Bericht, den alle Eigentümer bekommen.
            (istVerwalter && rueckstaendig.length > 0
              ? ` Betroffen: ${rueckstaendig
                  .map((e) => `${e.label} ${formatCents(opos.get(e.id)!.gesamtCents)}`)
                  .join(", ")}.`
              : ""),
    });

    // ── Der eigene Stand ───────────────────────────────────────────────────
    if (user.role === "EIGENTUEMER") {
      const meine = await ownedUnitIdsInProperty(user.id, objekt.id);
      const meineEinheiten = einheiten.filter((e) => meine.includes(e.id));
      if (meineEinheiten.length > 0) {
        const zeilen = meineEinheiten.map((e) => {
          const o = opos.get(e.id);
          const offen = o?.gesamtCents ?? 0;
          const guthaben = o?.nichtZugeordnetCents ?? 0;
          return (
            `${e.label}: ${offen > 0 ? `${formatCents(offen)} offen` : "nichts offen"}` +
            (guthaben > 0 ? `, ${formatCents(guthaben)} noch nicht zugeordnet` : "")
          );
        });
        quellen.push({
          type: "Ihr Hausgeld",
          title: `Ihr Hausgeld-Stand in ${objekt.name}`,
          href: "/finanzen",
          snippet: `Ihre Einheiten in diesem Objekt — ${zeilen.join("; ")}.`,
        });
      }
    }

    // ── Wo steht der Jahreslauf? ───────────────────────────────────────────
    const jahr = new Date().getFullYear();
    const [plan, abrechnung] = await Promise.all([
      db.economicPlan.findFirst({
        where: { propertyId: objekt.id, year: jahr },
        select: { status: true },
      }),
      db.annualStatement.findFirst({
        where: { propertyId: objekt.id, year: jahr - 1 },
        select: { status: true },
      }),
    ]);
    quellen.push({
      type: "Jahreslauf",
      title: `Wirtschaftsplan und Jahresabrechnung ${objekt.name}`,
      href: istVerwalter ? `/verwaltung/weg/${objekt.id}` : "/finanzen",
      snippet:
        `Wirtschaftsplan ${jahr}: ` +
        (!plan
          ? "noch nicht angelegt"
          : plan.status === "BESCHLOSSEN"
            ? "beschlossen"
            : "als Entwurf vorhanden, noch nicht beschlossen") +
        `. Jahresabrechnung ${jahr - 1}: ` +
        (!abrechnung
          ? "noch nicht begonnen"
          : abrechnung.status === "FERTIG"
            ? "fertiggestellt"
            : "in Arbeit (Entwurf)") +
        ".",
    });
  }

  return quellen;
}
