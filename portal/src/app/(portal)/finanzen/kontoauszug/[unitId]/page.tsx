import { notFound, redirect } from "next/navigation";
import { DataTable, type Column } from "@/components/data-display";
import { Tipp } from "@/components/tipp";
import { Alert, Card, EmptyState, PageTitle } from "@/components/ui";
import { Begriff } from "@/components/begriff";
import { canVerwalterAccessProperty, ownedUnitIdsInProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { getUser } from "@/lib/session";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { baueKontoauszug, saldoHeute, type AuszugZeile } from "@/lib/weg/kontoauszug";
import { basiszinssaetze, verzugJeForderung } from "@/lib/weg/verzug-service";

export const dynamic = "force-dynamic";

export default async function KontoauszugPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const { unitId } = await params;

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      id: true,
      label: true,
      propertyId: true,
      property: { select: { id: true, name: true, organizationId: true } },
    },
  });
  if (!unit) notFound();

  // **Die Zugriffsprüfung ist hier der wichtigste Teil der Seite.** Ein
  // Kontoauszug zeigt, wer wann wie viel geschuldet und gezahlt hat — wer den
  // eines Nachbarn lesen kann, hat einen Datenschutzvorfall. Geprüft wird
  // serverseitig gegen die Eigentümerschaft, nie gegen die URL.
  const eigene = await ownedUnitIdsInProperty(user.id, unit.propertyId);
  const erlaubt =
    eigene.includes(unit.id) ||
    (user.role === "VERWALTER" && (await canVerwalterAccessProperty(user, unit.propertyId)));
  if (!erlaubt) notFound();

  const now = new Date();
  const [sollstellungen, zahlungen, saetze] = await Promise.all([
    db.duePosting.findMany({
      where: { unitId: unit.id },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        dueDate: true,
        amountCents: true,
        periodYear: true,
        periodMonth: true,
        source: true,
        allocations: { select: { amountCents: true } },
      },
    }),
    // Angerechnete Zahlungen. Bewusst über die Zuordnungen und nicht über alle
    // Einnahmen der Einheit: Was noch keiner Forderung zugeordnet ist, steht
    // unten getrennt als Guthaben — sonst verdeckte es einen offenen Monat.
    db.paymentAllocation.findMany({
      where: { duePosting: { unitId: unit.id } },
      select: {
        amountCents: true,
        booking: { select: { bookingDate: true, text: true, counterparty: true } },
      },
    }),
    basiszinssaetze(unit.property.organizationId),
  ]);

  const zeilen = baueKontoauszug(
    sollstellungen,
    zahlungen.map((a) => ({
      bookingDate: a.booking.bookingDate,
      betragCents: a.amountCents,
      text: a.booking.counterparty
        ? `Zahlung ${a.booking.counterparty}`
        : a.booking.text || "Zahlung",
    })),
  );
  const saldo = saldoHeute(zeilen);

  // Nicht zugeordnete Zahlungen der Einheit — getrennt ausgewiesen.
  const offeneZahlungen = await db.booking.findMany({
    where: { unitId: unit.id, kind: "EINNAHME", ...NOT_REVERSED },
    select: { amountCents: true, allocations: { select: { amountCents: true } } },
  });
  const guthabenCents = offeneZahlungen.reduce(
    (s, b) => s + (b.amountCents - b.allocations.reduce((x, a) => x + a.amountCents, 0)),
    0,
  );

  // Verzugszinsen auf die fälligen offenen Forderungen (§ 288 Abs. 1 BGB).
  const faellig = sollstellungen
    .map((s) => ({
      id: s.id,
      dueDate: s.dueDate,
      offenCents: s.amountCents - s.allocations.reduce((x, a) => x + a.amountCents, 0),
    }))
    .filter((s) => s.offenCents > 0 && s.dueDate <= now);
  const zinsWerte = verzugJeForderung(faellig, saetze, now);
  let zinsenCents: number | null = 0;
  for (const z of zinsWerte.values()) {
    if (z.zinsenCents === null) {
      zinsenCents = null;
      break;
    }
    zinsenCents += z.zinsenCents;
  }

  const spalten: Column<AuszugZeile>[] = [
    {
      header: "Datum",
      cell: (z) => (
        <span className={z.kuenftig ? "text-gray-400" : undefined}>{formatDateOnly(z.datum)}</span>
      ),
    },
    {
      header: "Vorgang",
      cell: (z) => (
        <span className={z.kuenftig ? "text-gray-400" : undefined}>
          {z.text}
          {z.kuenftig ? <span className="ml-2 text-xs">noch nicht fällig</span> : null}
        </span>
      ),
    },
    {
      header: "Betrag",
      align: "right",
      cell: (z) => (
        <span
          className={
            z.kuenftig ? "text-gray-400" : z.betragCents < 0 ? "text-brand-green" : "text-gray-700"
          }
        >
          {formatCents(z.betragCents)}
        </span>
      ),
    },
    {
      header: "Saldo",
      align: "right",
      cell: (z) => (
        <span
          className={
            z.kuenftig
              ? "text-gray-400"
              : z.saldoCents > 0
                ? "font-medium text-gray-900"
                : "text-gray-500"
          }
        >
          {formatCents(z.saldoCents)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageTitle back={{ href: "/finanzen", label: "Finanzen" }}>
        Kontoauszug {unit.label}
      </PageTitle>

      <Card title={`${unit.property.name} · ${unit.label}`}>
        <Tipp className="mb-3">
          Hier steht jede Forderung und jede Zahlung in der Reihenfolge, in der sie entstanden
          sind. Der <strong>Saldo</strong> ist der Stand nach jeder Zeile: Ein positiver Betrag
          ist offen, eine 0 bedeutet ausgeglichen. Grau dargestellte Zeilen sind{" "}
          <strong>noch nicht fällig</strong> — sie zeigen, was kommt, und zählen nicht zu Ihrem
          heutigen Stand.
        </Tipp>

        <DataTable
          columns={spalten}
          rows={zeilen}
          getKey={(z, i) => `${z.datum.toISOString()}-${i}`}
          caption={`Kontoauszug ${unit.label}`}
          empty={<EmptyState>Für diese Einheit gibt es noch keine Bewegungen.</EmptyState>}
        />

        {zeilen.length > 0 ? (
          // Eigene Trennlinie und Abstand: Ohne sie klebte die Zeile am unteren
          // Kartenrand und sah abgeschnitten aus — ausgerechnet die Zahl, wegen
          // der die meisten diese Seite öffnen.
          <p className="mt-4 border-t border-gray-200 pt-4 text-sm">
            <strong>Stand heute:</strong>{" "}
            {saldo > 0 ? (
              <span className="font-semibold text-red-700">{formatCents(saldo)} offen</span>
            ) : saldo < 0 ? (
              <span className="font-semibold text-brand-green">
                {formatCents(-saldo)} im Voraus gezahlt
              </span>
            ) : (
              <span className="font-semibold text-brand-green">ausgeglichen</span>
            )}
          </p>
        ) : null}
      </Card>

      {/* Zinsen getrennt, nicht im Saldo. Sie sind eine eigene Forderung neben
          der Hauptforderung (§ 367 Abs. 1 BGB) — sie in den Auszug zu mischen
          machte die Spalte „Saldo" mehrdeutig. */}
      {zinsenCents !== 0 && saldo > 0 ? (
        <div className="mt-4">
          <Alert variant="warning" title="Verzugszinsen">
            {zinsenCents === null ? (
              <p>
                Auf den offenen Betrag fallen <Begriff name="verzugszinsen">Verzugszinsen</Begriff>{" "}
                an. Die Verwaltung hat den maßgeblichen Basiszinssatz noch nicht hinterlegt —
                der Betrag lässt sich hier deshalb nicht beziffern.
              </p>
            ) : (
              <p>
                Zusätzlich zum offenen Betrag sind bis heute{" "}
                <strong>{formatCents(zinsenCents)}</strong>{" "}
                <Begriff name="verzugszinsen">Verzugszinsen</Begriff> aufgelaufen. Sie enden mit
                dem Tag, an dem die Zahlung eingeht.
              </p>
            )}
          </Alert>
        </div>
      ) : null}

      {guthabenCents > 0 ? (
        <div className="mt-4">
          <Alert variant="info" title="Noch nicht zugeordnete Zahlung">
            Es liegen {formatCents(guthabenCents)} vor, die noch keiner Forderung zugeordnet
            sind — sie erscheinen deshalb oben nicht. Die Verwaltung ordnet sie zu; danach sinkt
            der Saldo entsprechend.
          </Alert>
        </div>
      ) : null}
    </>
  );
}
