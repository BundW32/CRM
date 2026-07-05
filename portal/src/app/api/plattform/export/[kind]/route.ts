import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildCsv } from "@/lib/csv";
import { formatInvoiceNumber, invoiceGrossCents, isPlatformAdminUser } from "@/lib/platform";
import { getUser } from "@/lib/session";
import { planLabel, subscriptionStatusLabel } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Cent → deutsches Dezimalformat ohne Tausenderpunkt ("1234,50") – bleibt in
// Excel/DATEV eine Zahl.
function money(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
function isoDate(d: Date | null): string {
  return d ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}` : "";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const user = await getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const { kind } = await params;

  let rows: unknown[][];
  let fileName: string;

  if (kind === "verwaltungen") {
    const orgs = await db.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true, slug: true, accountType: true, active: true, plan: true,
        subscriptionStatus: true, trialEndsAt: true, referralSource: true, createdAt: true,
        _count: { select: { users: true, properties: true } },
      },
    });
    rows = [
      ["Name", "Slug", "Typ", "Aktiv", "Tarif", "Status", "Trial-Ende", "Herkunft", "Nutzer", "Objekte", "Registriert"],
      ...orgs.map((o) => [
        o.name, o.slug,
        o.accountType === "selbstverwalter" ? "Selbstverwaltung" : "Hausverwaltung",
        o.active ? "ja" : "nein",
        planLabel(o.plan), subscriptionStatusLabel(o.subscriptionStatus),
        isoDate(o.trialEndsAt), o.referralSource ?? "",
        o._count.users, o._count.properties, isoDate(o.createdAt),
      ]),
    ];
    fileName = "Verwaltungen.csv";
  } else if (kind === "rechnungen" || kind === "datev") {
    const onlyPaid = kind === "datev";
    const invoices = await db.platformInvoice.findMany({
      where: onlyPaid ? { status: "BEZAHLT" } : {},
      orderBy: [{ year: "desc" }, { number: "desc" }],
      include: {
        organization: { select: { name: true } },
        items: { select: { quantity: true, unitPriceCents: true } },
      },
    });

    const withTotals = invoices.map((inv) => {
      const net = inv.items.reduce((s, it) => s + it.quantity * it.unitPriceCents, 0);
      const gross = invoiceGrossCents(inv.vatRate, inv.items);
      return { inv, net, vat: gross - net, gross };
    });

    if (kind === "datev") {
      // DATEV-freundlicher CSV (kein EXTF-Binärformat) – bezahlte Rechnungen.
      rows = [
        ["Belegdatum", "Rechnungsnummer", "Kunde", "Netto", "USt-Satz", "USt-Betrag", "Brutto", "Zahldatum"],
        ...withTotals.map(({ inv, net, vat, gross }) => [
          isoDate(inv.issuedAt ?? inv.createdAt),
          formatInvoiceNumber(inv.year, inv.number),
          inv.organization.name,
          money(net), inv.vatRate, money(vat), money(gross),
          isoDate(inv.paidAt),
        ]),
      ];
      fileName = "DATEV_bezahlte_Rechnungen.csv";
    } else {
      rows = [
        ["Nummer", "Verwaltung", "Titel", "Status", "Netto", "USt-Satz", "USt", "Brutto", "Rechnungsdatum", "Fällig", "Bezahlt"],
        ...withTotals.map(({ inv, net, vat, gross }) => [
          formatInvoiceNumber(inv.year, inv.number),
          inv.organization.name, inv.title, inv.status,
          money(net), inv.vatRate, money(vat), money(gross),
          isoDate(inv.issuedAt), isoDate(inv.dueAt), isoDate(inv.paidAt),
        ]),
      ];
      fileName = "Rechnungen.csv";
    }
  } else {
    return NextResponse.json({ error: "Unbekannter Export" }, { status: 404 });
  }

  return new NextResponse(buildCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
