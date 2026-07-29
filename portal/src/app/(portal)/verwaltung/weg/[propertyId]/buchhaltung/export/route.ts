import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { buildCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { fiscalYearRange } from "@/lib/weg/economic-plan";
import {
  JOURNAL_KOPF,
  KONTOBLATT_KOPF,
  baueKontoblatt,
  journalZeilen,
  kontoblattZeilen,
  vorzeichenBetrag,
  type JournalBuchung,
} from "@/lib/weg/journal";

export const dynamic = "force-dynamic";

/**
 * Journal und Kontoblatt als CSV.
 *
 * `art=journal` — alle Buchungen des Wirtschaftsjahres in zeitlicher Folge.
 * `art=kontoblatt&konto=<id>` — ein Konto mit fortlaufendem Saldo.
 *
 * **Nur für den Verwalter im Objekt-Scope.** Der Eigentümer hat sein
 * Einsichtsrecht nach § 18 Abs. 4 WEG über die Belegeinsicht unter „Finanzen";
 * ein Massen-Download der gesamten Buchhaltung als Datei ist etwas anderes als
 * Einsicht und gehört nicht dazu.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const user = await getUser();
  if (!user || user.role !== "VERWALTER") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  }
  const { propertyId } = await params;
  if (!(await canVerwalterAccessProperty(user, propertyId))) {
    return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });
  }
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: user.organizationId, managementType: "WEG" },
    select: { id: true, name: true, fiscalYearStartMonth: true },
  });
  if (!property) return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });

  const url = new URL(request.url);
  const art = url.searchParams.get("art") === "kontoblatt" ? "kontoblatt" : "journal";
  const jahrRoh = Number(url.searchParams.get("jahr"));
  const jahr =
    Number.isInteger(jahrRoh) && jahrRoh >= 2000 && jahrRoh <= 2200
      ? jahrRoh
      : new Date().getFullYear();
  const { start, end } = fiscalYearRange(jahr, property.fiscalYearStartMonth);

  const kontoId = url.searchParams.get("konto") ?? "";
  // Kontoblatt ohne gültiges Konto wäre eine leere Datei mit Kopfzeile — das
  // sieht nach „keine Buchungen" aus statt nach „falsch aufgerufen".
  const konto = kontoId
    ? await db.ledgerAccount.findFirst({
        where: { id: kontoId, propertyId: property.id },
        select: { id: true, name: true, openingBalanceCents: true },
      })
    : null;
  if (art === "kontoblatt" && !konto) {
    return NextResponse.json({ error: "Konto nicht gefunden" }, { status: 404 });
  }

  try {
    // Bewusst **ohne** NOT_REVERSED: Journal und Kontoblatt zeigen den
    // vollständigen Bestand samt Stornopaaren. Sie heben sich im Saldo von
    // selbst auf und werden in der Spalte „Hinweis" benannt.
    const roh = await db.booking.findMany({
      where: {
        propertyId: property.id,
        bookingDate: { gte: start, lt: end },
        ...(konto ? { accountId: konto.id } : {}),
      },
      select: {
        id: true,
        bookingDate: true,
        valueDate: true,
        kind: true,
        transferOut: true,
        amountCents: true,
        text: true,
        reference: true,
        counterparty: true,
        belegStoredName: true,
        reversalOfId: true,
        account: { select: { name: true } },
        costType: { select: { name: true } },
        unit: { select: { label: true } },
        craftsman: { select: { name: true, company: true } },
        reversedBy: { select: { id: true } },
      },
    });

    const buchungen: JournalBuchung[] = roh.map((x) => ({
      id: x.id,
      bookingDate: x.bookingDate,
      valueDate: x.valueDate,
      kind: x.kind,
      transferOut: x.transferOut,
      amountCents: x.amountCents,
      text: x.text,
      reference: x.reference,
      counterparty: x.counterparty,
      accountName: x.account.name,
      costTypeName: x.costType?.name ?? null,
      unitLabel: x.unit?.label ?? null,
      craftsmanName: x.craftsman?.company || x.craftsman?.name || null,
      hatBeleg: Boolean(x.belegStoredName),
      storniert: Boolean(x.reversedBy),
      istStorno: x.reversalOfId !== null,
    }));

    let csv: string;
    let name: string;
    if (art === "kontoblatt" && konto) {
      // Anfangsbestand des **Zeitraums**, nicht des Kontos: Eröffnungssaldo
      // plus alles, was vor dem Wirtschaftsjahr gebucht wurde. Ohne diesen
      // Vorlauf begänne das Blatt jedes Jahr wieder bei null.
      const davor = await db.booking.findMany({
        where: { accountId: konto.id, bookingDate: { lt: start } },
        select: { kind: true, transferOut: true, amountCents: true },
      });
      const anfangsbestandCents =
        konto.openingBalanceCents + davor.reduce((s, x) => s + vorzeichenBetrag(x), 0);

      const blatt = baueKontoblatt({
        kontoName: konto.name,
        anfangsbestandCents,
        buchungen,
      });
      csv = buildCsv([[...KONTOBLATT_KOPF], ...kontoblattZeilen(blatt)]);
      name = `Kontoblatt_${konto.name}_${jahr}`;
    } else {
      csv = buildCsv([[...JOURNAL_KOPF], ...journalZeilen(buchungen)]);
      name = `Journal_${property.name}_${jahr}`;
    }

    const dateiname = `${name.replace(/[^a-zA-Z0-9]+/g, "_")}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dateiname}"`,
      },
    });
  } catch (err) {
    console.error("Journal-/Kontoblatt-Export fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
