import Link from "next/link";
import { Card, buttonSecondaryClass } from "@/components/ui";
import { Tipp } from "@/components/tipp";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { loadRoadmap } from "@/lib/weg/roadmap";
import { loadSetupStatus } from "@/lib/weg/setup-status";
import { Roadmap } from "@/app/(portal)/dashboard/Roadmap";
import { SetupGuide } from "@/app/(portal)/dashboard/SetupGuide";

/**
 * Finanz-Arbeitsbereich eines WEG-Objekts.
 *
 * Wird von zwei Routen gerendert: von der Objektauswahl (`weg/page.tsx`) bei
 * genau einem Objekt und von `weg/[propertyId]/page.tsx` sonst. Eine Fassung,
 * zwei Einstiege — die Alternative wären zwei Seiten, die auseinanderlaufen.
 *
 * Die Seite beantwortet zuerst die zwei Fragen, um die es in einer Buchhaltung
 * geht: „wie viel Geld haben wir?" und „was muss ich als Nächstes tun?".
 *
 * **Was ansteht** kommt aus `loadRoadmap` — derselben Ableitung wie im
 * Selbstverwalter-Dashboard, keine zweite Liste. Für professionelle
 * Verwaltungen ist das der einzige Ort, an dem der Fahrplan überhaupt
 * erscheint: ihr Dashboard ist ein anderes. Selbstverwaltete Gemeinschaften
 * sehen ihn schon auf der Übersicht und bekommen hier nur den Verweis.
 *
 * Die Navigation folgt darunter der Zeitachse (einrichten · laufend ·
 * Jahreslauf), nicht Themengruppen: Der Wirtschaftsplan entsteht vor dem Jahr,
 * die Abrechnung danach.
 */
export async function WegArbeitsbereich({
  property,
  selfManaged,
}: {
  property: { id: string; name: string };
  selfManaged: boolean;
}) {
  const basis = `/verwaltung/weg/${property.id}`;

  const [accounts, sums, ohneKostenart, offeneZahlungen, roadmap] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { propertyId: property.id, active: true },
      select: { id: true, kind: true, openingBalanceCents: true },
    }),
    db.booking.groupBy({
      by: ["accountId", "kind", "transferOut"],
      where: { propertyId: property.id },
      _sum: { amountCents: true },
    }),
    // Buchhalterischer Arbeitsvorrat. Beide Zahlen kennt der Jahresfahrplan
    // nicht — sie haben keine Frist, blockieren aber den Jahresabschluss.
    db.booking.count({
      where: {
        propertyId: property.id,
        costTypeId: null,
        kind: { in: ["EINNAHME", "AUSGABE"] },
        ...NOT_REVERSED,
      },
    }),
    db.booking.count({
      where: { propertyId: property.id, kind: "EINNAHME", unitId: null, ...NOT_REVERSED },
    }),
    selfManaged ? Promise.resolve(null) : loadRoadmap(property.id),
  ]);

  const setup = await loadSetupStatus(property.id);

  const saldo = (accountId: string, opening: number) => {
    let b = opening;
    for (const s of sums) {
      if (s.accountId !== accountId) continue;
      const amount = s._sum.amountCents ?? 0;
      if (s.kind === "EINNAHME") b += amount;
      else if (s.kind === "AUSGABE") b -= amount;
      else b += s.transferOut ? -amount : amount;
    }
    return b;
  };
  const summe = (kind: "GIRO" | "RUECKLAGE") =>
    accounts
      .filter((a) => a.kind === kind)
      .reduce((sum, a) => sum + saldo(a.id, a.openingBalanceCents), 0);

  const bereiche: { label: string; hint: string; items: { href: string; label: string }[] }[] = [
    {
      label: "Einrichten",
      hint: "Einmalig — Einheiten, Kostenarten, Konten",
      items: [{ href: `${basis}/stammdaten`, label: "Stammdaten & Konten" }],
    },
    {
      label: "Laufendes Jahr",
      hint: "Die regelmäßige Arbeit",
      items: [
        { href: `${basis}/buchhaltung`, label: "Buchhaltung" },
        { href: `${basis}/hausgeld`, label: "Hausgeld & offene Posten" },
        { href: `${basis}/sonderumlagen`, label: "Sonderumlagen" },
        { href: `${basis}/verbindlichkeiten`, label: "Verbindlichkeiten" },
        { href: `${basis}/lastschrift`, label: "SEPA-Lastschrift" },
      ],
    },
    {
      label: "Jahreslauf",
      hint: "Der Plan entsteht vor dem Jahr, die Abrechnung danach",
      items: [
        { href: `${basis}/wirtschaftsplan`, label: "1. Wirtschaftsplan" },
        { href: `${basis}/jahresabrechnung`, label: "2. Jahresabrechnung" },
        { href: `${basis}/betriebskosten`, label: "3. Betriebskosten (Mieter)" },
        { href: `${basis}/co2`, label: "CO₂-Aufteilung" },
      ],
    },
    {
      label: "Dauerthemen",
      hint: "Laufen neben dem Jahreszyklus",
      items: [
        { href: `${basis}/pruefpflichten`, label: "Prüfpflichten" },
        { href: `${basis}/erhaltungsplanung`, label: "Erhaltungsplanung" },
      ],
    },
  ];

  return (
    <div className="grid gap-4">
      {/* Wie viel Geld haben wir? */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Laufendes Konto">
          <p className="text-3xl font-semibold text-gray-900">{formatCents(summe("GIRO"))}</p>
          <Tipp className="mt-1">
            Geld für die laufenden Kosten der Gemeinschaft
          </Tipp>
        </Card>
        <Card title="Erhaltungsrücklage">
          <p className="text-3xl font-semibold text-gray-900">{formatCents(summe("RUECKLAGE"))}</p>
          <Tipp className="mt-1">
            Das Gesparte für große Reparaturen — getrennt vom laufenden Konto
          </Tipp>
        </Card>
      </div>

      {/* Buchhalterischer Arbeitsvorrat: ohne Frist, aber blockierend. */}
      {ohneKostenart > 0 || offeneZahlungen > 0 ? (
        <Card title="In der Buchhaltung offen">
          <ul className="grid gap-2">
            {ohneKostenart > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm text-gray-700">
                  {ohneKostenart} {ohneKostenart === 1 ? "Buchung ist" : "Buchungen sind"} keiner
                  Kostenart zugeordnet — sie {ohneKostenart === 1 ? "kann" : "können"} nicht
                  umgelegt werden und {ohneKostenart === 1 ? "blockiert" : "blockieren"} die
                  Jahresabrechnung.
                </span>
                <Link href={`${basis}/buchhaltung?zuordnung=offen`} className={buttonSecondaryClass}>
                  Zuordnen
                </Link>
              </li>
            ) : null}
            {offeneZahlungen > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <span className="min-w-0 flex-1 text-sm text-gray-700">
                  {offeneZahlungen}{" "}
                  {offeneZahlungen === 1 ? "Zahlungseingang ist" : "Zahlungseingänge sind"} noch
                  keiner Einheit zugeordnet — bis dahin{" "}
                  {offeneZahlungen === 1 ? "gilt er" : "gelten sie"} nicht als bezahlt.
                </span>
                <Link href={`${basis}/hausgeld`} className={buttonSecondaryClass}>
                  Ansehen
                </Link>
              </li>
            ) : null}
          </ul>
        </Card>
      ) : null}

      {/* Die Einrichtung dieses Objekts, solange sie läuft.
          Hier steht sie richtig: Der Assistent hing bisher am Dashboard der
          Selbstverwaltung und erreichte professionelle Verwaltungen deshalb
          nie — obwohl auch B&W neue WEGs aufnimmt und dieselbe fachlich
          zwingende Reihenfolge einhalten muss. Der Arbeitsbereich gehört
          ohnehin zu genau einem Objekt; damit ist auch die Frage erledigt,
          welches gemeint ist. */}
      {!setup.fertig ? <SetupGuide status={setup} isAdmin objektName={property.name} /> : null}

      {/* Was ansteht — dieselbe Ableitung wie im Dashboard. */}
      {roadmap ? (
        <Roadmap items={roadmap} properties={[property]} />
      ) : (
        <Tipp className="px-1">
          Was in diesem Jahr ansteht, steht auf Ihrer{" "}
          <Link href="/dashboard" className="underline">
            Übersicht
          </Link>
          .
        </Tipp>
      )}

      <Card title="Bereiche">
        <div className="grid gap-4">
          {bereiche.map((g) => (
            <div key={g.label}>
              <p className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
                {g.label}
              </p>
              <p className="mb-2 text-xs text-gray-400">{g.hint}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <Link key={it.href} href={it.href} className={buttonSecondaryClass}>
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
