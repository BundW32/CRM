import Link from "next/link";
import { Badge } from "@/components/data-display";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, PageTitle, Pagination, buttonSecondaryClass, inputClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { reminderLevelLabel } from "@/lib/dunning";
import { formatDateOnly } from "@/lib/labels";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort } from "@/lib/list-query";
import { DateField, SelectField, toDateInputValue } from "@/components/fields";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { ersterFehlenderSollmonat } from "@/lib/weg/due-postings";
import { oposJeEinheit } from "@/lib/weg/opos-service";
import { OPOS_BUCKETS, OPOS_BUCKET_LABELS, leereOposZeile } from "@/lib/weg/payment-allocation";
import {
  assignPayment,
  createMahnung,
  deleteMahnung,
  markMahnungSent,
  saveUebernahme,
  schreibeSollstellungenFort,
  ordneZahlungZu,
  loeseZuordnung,
} from "./actions";

const MONAT = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export const dynamic = "force-dynamic";

// Drei Listen auf einer Seite, drei Paginierungen. Der Einwand „`page` gibt es je
// Seite nur einmal" stimmt – deshalb bekommt jede Liste ihren EIGENEN Parameter
// (`page`, `aseite`, `mseite`). Damit setzt Blättern in einer Liste die anderen
// nicht zurück. Ohne das blieben zugeordnete Zahlungen bei 20 und Mahnschreiben
// bei 50 hängen, ohne Weg zu älteren Einträgen.
const PAGE_SIZE = 25;
const ASSIGNED_PAGE_SIZE = 20;
const MAHNUNG_PAGE_SIZE = 50;

// Sortierung der Rückstandsliste. Sie liegt vollständig im Speicher (alle
// Einheiten eines Objekts) und blättert nicht – daher kein Prisma-orderBy,
// sondern ein Vergleich. Die Whitelist bleibt trotzdem: nichts aus der URL
// darf ungeprüft ein Feld benennen.
const STAND_SORT_FIELDS = { einheit: "einheit", saldo: "saldo", soll: "soll", gezahlt: "gezahlt" } as const;

const standSortOptions = [
  { value: "einheit", label: "Einheit" },
  { value: "saldo", label: "Saldo" },
  { value: "soll", label: "Soll (fällig)" },
  { value: "gezahlt", label: "Gezahlt" },
];

const STAND_FILTER: FilterConfig = {
  key: "stand",
  label: "Stand",
  allLabel: "Alle Einheiten",
  primary: true,
  options: [
    { value: "rueckstand", label: "Nur Rückstände" },
    { value: "ausgeglichen", label: "Ausgeglichen" },
  ],
};

const MAHN_FILTER: FilterConfig = {
  key: "mahnstatus",
  label: "Status",
  allLabel: "Alle Schreiben",
  primary: true,
  options: [
    { value: "entwurf", label: "Noch nicht versendet" },
    { value: "versendet", label: "Versendet" },
  ],
};

// Zuordnungs-Hilfe: Welche Einheit steckt hinter dieser Zahlung?
//
// Drei Wege, in dieser Reihenfolge — je sicherer, desto früher:
//
// 1. **IBAN** aus dem SEPA-Mandat. Die Kontonummer des Zahlenden ist der
//    verlässlichste Hinweis überhaupt; sie steht in jedem Bankumsatz.
// 2. **Einheiten-Kurzlabel** im Verwendungszweck („WE 01").
// 3. **Nachname des Eigentümers** im Zahlungspartner. Zuletzt, weil Namen sich
//    wiederholen: Zwei Eigentümer namens Müller machen den Hinweis wertlos —
//    deshalb zählt er nur, wenn der Name im Objekt eindeutig ist.
//
// Es bleibt ein *Vorschlag*: Zugeordnet wird erst, wenn der Verwalter bestätigt.
function suggestUnit(
  booking: { text: string; reference: string | null; counterparty: string | null },
  units: { id: string; label: string }[],
  unitByIban: Map<string, string>,
  unitByNachname: Map<string, string>,
): string | null {
  const roh = `${booking.text} ${booking.reference ?? ""} ${booking.counterparty ?? ""}`;
  const haystack = roh.toLowerCase().replace(/\s+/g, " ");

  // 1) IBAN — im Umsatztext meist mit Leerzeichen, deshalb entfernen.
  const kompakt = roh.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (const [iban, unitId] of unitByIban) {
    if (iban.length >= 15 && kompakt.includes(iban)) return unitId;
  }

  // 2) Kurzform: erster Label-Teil vor dem Komma ("WE 01, EG links" → "we 01")
  for (const u of units) {
    const short = u.label.split(",")[0].trim().toLowerCase();
    if (short.length >= 3 && haystack.includes(short)) return u.id;
  }

  // 3) Nachname, nur wenn im Objekt eindeutig.
  for (const [nachname, unitId] of unitByNachname) {
    if (nachname.length >= 4 && haystack.includes(nachname)) return unitId;
  }
  return null;
}

export default async function HausgeldPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;
  const now = new Date();

  // ── Filter ────────────────────────────────────────────────────────────────
  // Ausgangspunkt bleibt das Objekt aus `requireWegProperty`; die Filter
  // verengen nur. Geblättert werden die offenen Zahlungseingänge – die
  // Arbeitsliste, die zuvor nach 50 Einträgen endete.
  const q = normalizeSearch(sp.q);
  const currentPage = parsePage(sp.page);
  const aPage = parsePage(sp.aseite);
  const mPage = parsePage(sp.mseite);

  const offeneAnd: Prisma.BookingWhereInput[] = [
    { propertyId: property.id, kind: "EINNAHME", unitId: null },
  ];
  if (q) {
    offeneAnd.push({
      OR: [
        { text: { contains: q, mode: "insensitive" } },
        { counterparty: { contains: q, mode: "insensitive" } },
        { reference: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const offeneWhere: Prisma.BookingWhereInput = { AND: offeneAnd };

  const zugeordnetWhere: Prisma.BookingWhereInput = {
    propertyId: property.id,
    kind: "EINNAHME",
    unitId: { not: null },
  };

  const mahnstatus = sp.mahnstatus === "entwurf" || sp.mahnstatus === "versendet" ? sp.mahnstatus : undefined;
  const mahnungWhere: Prisma.HausgeldMahnungWhereInput = {
    propertyId: property.id,
    ...(mahnstatus === "entwurf" ? { sentAt: null } : {}),
    ...(mahnstatus === "versendet" ? { sentAt: { not: null } } : {}),
  };

  // Alles, was voneinander unabhängig ist, in EINEM Zug. Vorher standen hier
  // sechs `await`-Stufen hintereinander, obwohl keine auf die vorige wartet —
  // jede Stufe kostet eine eigene Wartezeit zur Datenbank, und sie addieren
  // sich zur Ladezeit der Seite.
  const [
    units,
    dueSums,
    paidSums,
    unassignedTotal,
    unassigned,
    assigned,
    assignedTotal,
    mahnungen,
    mahnungTotal,
    mahnStufen,
    uebernahme,
    opos,
    mandate,
    aktuelleEigentuemer,
    fehlenderSollmonat,
  ] = await Promise.all([
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    // Soll: fällige Sollstellungen je Einheit (bis heute)
    db.duePosting.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, dueDate: { lte: now } },
      _sum: { amountCents: true },
      _count: true,
    }),
    // Ist: zugeordnete Zahlungseingänge je Einheit
    db.booking.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, kind: "EINNAHME", unitId: { not: null }, ...NOT_REVERSED },
      _sum: { amountCents: true },
    }),
    // Noch nicht zugeordnete Zahlungseingänge
    db.booking.count({ where: offeneWhere }),
    db.booking.findMany({
      where: offeneWhere,
      orderBy: { bookingDate: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Bereits zugeordnete (zur Kontrolle, mit Lösen-Option)
    db.booking.findMany({
      where: zugeordnetWhere,
      include: {
        unit: { select: { label: true } },
        // Worauf die Zahlung angerechnet wurde (§§ 366, 367 BGB).
        allocations: {
          select: {
            amountCents: true,
            duePosting: { select: { periodYear: true, periodMonth: true, source: true } },
          },
        },
      },
      orderBy: { bookingDate: "desc" },
      skip: (aPage - 1) * ASSIGNED_PAGE_SIZE,
      take: ASSIGNED_PAGE_SIZE,
    }),
    db.booking.count({ where: zugeordnetWhere }),
    // Angezeigte Schreiben – filterbar und geblättert.
    db.hausgeldMahnung.findMany({
      where: mahnungWhere,
      include: { unit: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
      skip: (mPage - 1) * MAHNUNG_PAGE_SIZE,
      take: MAHNUNG_PAGE_SIZE,
    }),
    db.hausgeldMahnung.count({ where: mahnungWhere }),
    // Grundlage der Eskalation – bewusst ungefiltert und ohne Deckel. Würde die
    // Stufe aus der angezeigten Liste abgeleitet, böte ein gesetzter Filter (oder
    // das Abschneiden bei 50) eine bereits versendete Mahnstufe erneut an.
    db.hausgeldMahnung.findMany({
      where: { propertyId: property.id },
      select: { unitId: true, level: true, sentAt: true },
    }),
    // Übernommener Stand aus der bisherigen Verwaltung (source = UEBERNAHME).
    // Getrennt geladen, damit die Karte zeigen kann, was bereits erfasst ist –
    // die Rückstandsliste selbst rechnet ihn ohne Sonderfall mit.
    db.duePosting.findMany({
      where: { propertyId: property.id, source: "UEBERNAHME" },
      select: { unitId: true, amountCents: true, dueDate: true },
    }),
    // Offene Posten je Einheit — je Forderung gerechnet statt als Differenz
    // zweier Summen. Erst dadurch stimmt der Rückstand, wenn eine Sonderumlage
    // bezahlt oder im Voraus überwiesen wurde (siehe payment-allocation.ts).
    oposJeEinheit(property.id, now),
    // Bausteine der Zuordnungs-Hilfe (siehe `suggestUnit`).
    db.sepaMandate.findMany({
      where: { propertyId: property.id, active: true },
      select: { unitId: true, iban: true },
    }),
    db.unitOwnership.findMany({
      where: {
        unit: { propertyId: property.id },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { unitId: true, user: { select: { name: true } } },
    }),
    // Fortgeltung (§ 28 Abs. 1 Satz 2 WEG): Fehlen Monate, für die schon
    // Forderungen bestehen müssten?
    ersterFehlenderSollmonat(property.id, now),
  ]);
  // Nächste Mahnstufe je Einheit (nur versendete eskalieren) + offene Entwürfe
  const maxSentByUnit = new Map<string, number>();
  const draftUnits = new Set<string>();
  for (const m of mahnStufen) {
    if (m.sentAt) {
      maxSentByUnit.set(m.unitId, Math.max(maxSentByUnit.get(m.unitId) ?? 0, m.level));
    } else {
      draftUnits.add(m.unitId);
    }
  }

  const uebernahmeByUnit = new Map(uebernahme.map((u) => [u.unitId, u.amountCents]));
  const uebernahmeSumme = uebernahme.reduce((s, u) => s + u.amountCents, 0);
  const uebernahmeStichtag = uebernahme[0]?.dueDate ?? null;

  const unitByIban = new Map(
    mandate.map((m) => [m.iban.toUpperCase().replace(/[^A-Z0-9]/g, ""), m.unitId]),
  );
  // Mehrdeutige Nachnamen fliegen raus: Ein Hinweis, der auf zwei Einheiten
  // passt, ist kein Hinweis, sondern eine Fehlerquelle.
  const nachnameZaehler = new Map<string, Set<string>>();
  for (const o of aktuelleEigentuemer) {
    const nachname = o.user.name.trim().split(/\s+/).at(-1)?.toLowerCase();
    if (!nachname) continue;
    const menge = nachnameZaehler.get(nachname) ?? new Set<string>();
    menge.add(o.unitId);
    nachnameZaehler.set(nachname, menge);
  }
  const unitByNachname = new Map(
    [...nachnameZaehler.entries()]
      .filter(([, einheiten]) => einheiten.size === 1)
      .map(([nachname, einheiten]) => [nachname, [...einheiten][0]]),
  );

  const dueByUnit = new Map(dueSums.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
  const paidByUnit = new Map(paidSums.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));
  const hasPostings = dueSums.length > 0;
  // Summen immer über ALLE Einheiten – eine Summenzeile, die sich mit dem
  // Filter verändert, wäre keine Summe der Gemeinschaft mehr.
  const totalDue = [...dueByUnit.values()].reduce((a, b) => a + b, 0);
  const totalPaid = [...paidByUnit.values()].reduce((a, b) => a + b, 0);

  // Rückstandsliste filtern (im Speicher – die Einheiten liegen ohnehin alle vor).
  // Negativ = Rückstand, damit die bisherige Sortier- und Filterlogik gilt.
  const saldoFor = (unitId: string) => -(opos.get(unitId)?.gesamtCents ?? 0);
  const gefilterteUnits =
    sp.stand === "rueckstand"
      ? units.filter((u) => saldoFor(u.id) < 0)
      : sp.stand === "ausgeglichen"
        ? units.filter((u) => saldoFor(u.id) >= 0)
        : units;

  // „Wer schuldet am meisten" ist die häufigste Frage an diese Liste – deshalb
  // steht beim Saldo aufsteigend (= größter Rückstand zuerst) als Voreinstellung.
  const standSort = resolveSort(sp.sort, sp.dir, STAND_SORT_FIELDS, "einheit", "asc");
  const standValue = (unitId: string) =>
    standSort.key === "saldo"
      ? saldoFor(unitId)
      : standSort.key === "soll"
        ? dueByUnit.get(unitId) ?? 0
        : paidByUnit.get(unitId) ?? 0;
  const sichtbareUnits = [...gefilterteUnits].sort((a, b) => {
    const cmp =
      standSort.key === "einheit"
        ? a.label.localeCompare(b.label, "de", { numeric: true })
        : standValue(a.id) - standValue(b.id);
    return standSort.dir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(unassignedTotal / PAGE_SIZE));

  // Paginierung muss alle aktiven Filter mittragen. `param` benennt die Liste,
  // die geblättert wird – die übrigen behalten dadurch ihre Position.
  // Drei unabhängig blätterbare Listen auf einer Seite – daher drei Params.
  // Jede Filterleiste muss den ihren kennen (`pageParam`), sonst bliebe beim
  // Filtern die Seitenzahl der falschen Liste stehen.
  const hausgeldPath = `/verwaltung/weg/${property.id}/hausgeld`;
  const mahnungHref = pageHrefFor(hausgeldPath, sp, "mseite");
  const assignedHref = pageHrefFor(hausgeldPath, sp, "aseite");
  const pageHref = pageHrefFor(hausgeldPath, sp);

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
        action={
          <div className="flex gap-2">
            <Link
              href={`/verwaltung/weg/${property.id}/wirtschaftsplan`}
              className={buttonSecondaryClass}
            >
              Wirtschaftsplan
            </Link>
            <Link href={`/verwaltung/weg/${property.id}/buchhaltung`} className={buttonSecondaryClass}>
              Buchhaltung
            </Link>
            <Link href={`/verwaltung/weg/${property.id}/sonderumlagen`} className={buttonSecondaryClass}>
              Sonderumlagen
            </Link>
          </div>
        }
      >
        Hausgeld & offene Posten · {property.name}
      </PageTitle>

      {sp.zugeordnet ? (
        <Alert variant="success" className="mb-4">
          Zahlung zugeordnet.
        </Alert>
      ) : null}
      {sp.geloest ? (
        <Alert variant="success" className="mb-4">
          Zuordnung aufgehoben.
        </Alert>
      ) : null}
      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {sp.gespeichert === "mahnung"
            ? "Schreiben erstellt — unten als PDF herunterladen und nach dem Versand als versendet markieren."
            : sp.gespeichert === "versendet"
              ? "Als versendet markiert."
              : "Gespeichert."}
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {sp.fehler === "keinrueckstand"
            ? "Für diese Einheit besteht kein Rückstand."
            : sp.fehler === "entwurfoffen"
              ? "Für diese Einheit liegt bereits ein unversendeter Entwurf vor."
              : sp.fehler === "keineigentuemer"
                ? "Für diese Einheit ist kein Eigentümer erfasst — bitte in den Stammdaten zuordnen."
                : sp.fehler === "versendet"
                  ? "Versendete Schreiben bleiben als Nachweis erhalten und können nicht gelöscht werden."
                  : sp.fehler === "stichtag"
                    ? "Bitte einen gültigen Stichtag für die Übernahme angeben."
                    : sp.fehler === "keinplan"
                      ? "Es gibt keinen beschlossenen Wirtschaftsplan, der fortgelten könnte. Bitte zuerst einen Plan beschließen."
                      : sp.fehler === "stammdaten"
                        ? "Die Verteilung lässt sich nicht rechnen — bei mindestens einer Einheit fehlen Stammdaten (MEA, Wohnfläche oder Personenzahl)."
                        : sp.fehler === "ohneeinheit"
                          ? "Diese Zahlung ist keiner Einheit zugeordnet — ohne Einheit ist nicht bekannt, auf wessen Forderungen sie anzurechnen wäre."
                          : sp.fehler === "schonzugeordnet"
                            ? "Diese Zahlung ist bereits vollständig angerechnet."
                            : sp.fehler === "keineforderung"
                              ? "Für diese Einheit ist keine fällige Forderung offen. Eine Vorauszahlung bleibt bewusst als Guthaben stehen."
                              : "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      {sp.angerechnet ? (
        <Alert variant={sp.guthaben && sp.guthaben !== "0" ? "warning" : "success"} className="mb-4">
          {formatCents(Number(sp.angerechnet))} auf offene Forderungen angerechnet — älteste zuerst,
          gemahnte vorrangig (§ 366 Abs. 2 BGB).
          {sp.guthaben && sp.guthaben !== "0"
            ? ` ${formatCents(Number(sp.guthaben))} bleiben als Guthaben stehen: Vorauszahlungen tilgen keine künftigen Forderungen.`
            : ""}
        </Alert>
      ) : null}
      {sp.anrechnunggeloest ? (
        <Alert variant="success" className="mb-4">
          Anrechnung aufgehoben — die Zahlung bleibt der Einheit zugeordnet.
        </Alert>
      ) : null}

      {sp.fortgeschrieben ? (
        <Alert variant="success" className="mb-4">
          {sp.fortgeschrieben === "0"
            ? "Es fehlten keine Forderungen — alles war bereits erfasst."
            : `${sp.fortgeschrieben} ${sp.fortgeschrieben === "1" ? "Forderung wurde" : "Forderungen wurden"} nachgezogen.`}
        </Alert>
      ) : null}

      {/* Fortgeltung (§ 28 Abs. 1 Satz 2 WEG). Der Hinweis erscheint nur, wenn
          tatsächlich Monate fehlen — sonst wäre er ein Knopf ohne Anlass. */}
      {fehlenderSollmonat ? (
        <Alert variant="warning" title="Hausgeld-Forderungen fehlen" className="mb-4">
          <p>
            Seit {MONAT[fehlenderSollmonat.month - 1]} {fehlenderSollmonat.year} sind keine
            monatlichen Forderungen mehr entstanden. Der zuletzt beschlossene Wirtschaftsplan
            gilt fort, bis ein neuer beschlossen ist (§ 28 Abs. 1 Satz 2 WEG) — die Eigentümer
            schulden das Hausgeld also weiterhin, es war hier nur nicht erfasst. Ohne die
            Forderungen gibt es keine Rückstände, nichts zu mahnen und nichts einzuziehen.
          </p>
          <form action={schreibeSollstellungenFort} className="mt-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <PendingButton className={buttonSecondaryClass}>
              Forderungen nachziehen
            </PendingButton>
          </form>
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Übernahme aus der bisherigen Verwaltung — der Moment, in dem eine
            Selbstverwaltung beginnt. Eingeklappt, solange nichts erfasst ist,
            damit die Karte nicht jeden Aufruf dominiert; sie steht aber VOR der
            Rückstandsliste, weil sie deren Ausgangswert setzt. */}
        <Card title="Stand aus der bisherigen Verwaltung">
          {/* Offen, SOLANGE nichts erfasst ist – danach genügt die Zusammenfassung
              in der Zeile. Die Übernahme macht man einmal beim Amtsantritt; steht
              sie, ist sie Nachschlagewerk, kein Arbeitsplatz. */}
          <details id="uebernahme" open={uebernahme.length === 0}>
            <summary className="cursor-pointer list-none text-sm font-medium text-brand-green hover:underline">
              {uebernahmeSumme !== 0
                ? `Übernommen: ${formatCents(uebernahmeSumme)} zum ${uebernahmeStichtag ? formatDateOnly(uebernahmeStichtag) : "—"} — ändern`
                : "Offene Posten der bisherigen Verwaltung übernehmen"}
            </summary>
            <p className="mt-3 text-sm text-gray-600">
              Was einzelne Einheiten beim Amtsvorgänger noch schuldeten, steht sonst nirgends —
              die Rückstandsliste startet bei null und die Forderung ist faktisch verschwunden.
              Die Beträge stammen aus der letzten Abrechnung oder der Saldenliste der bisherigen
              Verwaltung.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Rückstand als positiver Betrag, Guthaben mit Minus davor. Kontostände ändern sich
              dadurch nicht — das Geld liegt bereits im übernommenen Anfangsbestand. Erneutes
              Speichern ersetzt den Stand, es summiert sich nichts auf.
            </p>
            <form action={saveUebernahme} className="mt-4">
              <input type="hidden" name="propertyId" value={property.id} />
              <DateField
                label="Stichtag der Übernahme"
                name="stichtag"
                required
                defaultValue={
                    uebernahmeStichtag ? toDateInputValue(uebernahmeStichtag) : undefined
                  }
                className="w-auto"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 truncate text-gray-600">{u.label}</span>
                    <input
                      name={`betrag_${u.id}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      defaultValue={
                        uebernahmeByUnit.get(u.id) !== undefined
                          ? (uebernahmeByUnit.get(u.id)! / 100).toFixed(2).replace(".", ",")
                          : ""
                      }
                      className={`${inputClass} w-28`}
                      aria-label={`Offener Posten der Einheit ${u.label} zum Stichtag`}
                    />
                    <span className="text-xs text-gray-400">€</span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <PendingButton className={buttonSecondaryClass}>Stand übernehmen</PendingButton>
              </div>
            </form>
          </details>
        </Card>

        <Card title="Rückstandsliste je Einheit">
          {!hasPostings ? (
            <EmptyState>
              Noch keine Sollstellungen — sie entstehen mit dem Beschluss eines{" "}
              <Link
                href={`/verwaltung/weg/${property.id}/wirtschaftsplan`}
                className="underline"
              >
                Wirtschaftsplans
              </Link>
              .
            </EmptyState>
          ) : (
            <>
            <div className="flex items-center justify-between gap-3">
              <FilterBar filters={[STAND_FILTER]} pageParam={[]} className="flex-1" />
              <SortControl sortOptions={standSortOptions} defaultSort="einheit" pageParam={[]} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Soll (fällig)</th>
                    <th className="py-2 pr-3 text-right">Gezahlt (zugeordnet)</th>
                    <th className="py-2 pr-3 text-right">Rückstand</th>
                    {/* Altersstruktur: Sind 1.200 € ein Monat bei mehreren
                        Eigentümern oder ein Jahr bei einem? Nur das Zweite
                        rechtfertigt die nächste Mahnstufe. */}
                    {OPOS_BUCKETS.map((b) => (
                      <th key={b} className="py-2 pr-3 text-right whitespace-nowrap">
                        {OPOS_BUCKET_LABELS[b]}
                      </th>
                    ))}
                    <th className="py-2 pr-3 text-right">Mahnwesen</th>
                  </tr>
                </thead>
                <tbody>
                  {sichtbareUnits.map((u) => {
                    const due = dueByUnit.get(u.id) ?? 0;
                    const paid = paidByUnit.get(u.id) ?? 0;
                    const zeile = opos.get(u.id) ?? { ...leereOposZeile(), unitId: u.id, nichtZugeordnetCents: 0 };
                    const rueckstand = zeile.gesamtCents;
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">{formatCents(due)}</td>
                        <td className="py-2 pr-3 text-right text-gray-700">
                          {formatCents(paid)}
                          {/* Ein nicht angerechnetes Guthaben wird getrennt
                              ausgewiesen, statt den Rückstand zu mindern: Sonst
                              verdeckte eine Vorauszahlung einen offenen Monat. */}
                          {zeile.nichtZugeordnetCents > 0 ? (
                            <span className="block text-xs font-normal text-amber-600">
                              {formatCents(zeile.nichtZugeordnetCents)} nicht angerechnet
                            </span>
                          ) : null}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-semibold ${
                            rueckstand > 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {rueckstand > 0 ? formatCents(rueckstand) : "ausgeglichen"}
                          {zeile.aeltesteFaelligkeit ? (
                            <span className="block text-xs font-normal text-red-500">
                              älteste offen seit {formatDateOnly(zeile.aeltesteFaelligkeit)}
                            </span>
                          ) : null}
                        </td>
                        {OPOS_BUCKETS.map((b) => (
                          <td
                            key={b}
                            className={`py-2 pr-3 text-right ${
                              b === "b90plus" && zeile.buckets[b] > 0
                                ? "font-semibold text-red-700"
                                : "text-gray-600"
                            }`}
                          >
                            {zeile.buckets[b] > 0 ? formatCents(zeile.buckets[b]) : "—"}
                          </td>
                        ))}
                        <td className="py-2 pr-3 text-right">
                          {rueckstand > 0 ? (
                            draftUnits.has(u.id) ? (
                              <span className="text-xs text-gray-400">Entwurf offen (unten)</span>
                            ) : (
                              <form action={createMahnung}>
                                <input type="hidden" name="propertyId" value={property.id} />
                                <input type="hidden" name="unitId" value={u.id} />
                                <button type="submit" className="text-sm text-red-700 underline">
                                  {reminderLevelLabel(
                                    Math.min((maxSentByUnit.get(u.id) ?? 0) + 1, 3),
                                  )}{" "}
                                  erstellen
                                </button>
                              </form>
                            )
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sichtbareUnits.length === 0 ? (
                    <tr>
                      <td colSpan={5 + OPOS_BUCKETS.length} className="py-6 text-center text-sm text-gray-500">
                        {sp.stand === "rueckstand"
                          ? "Keine Einheit im Rückstand."
                          : "Keine Einheit mit ausgeglichenem Saldo."}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="py-2 pr-3 font-semibold text-gray-900">
                      Summe
                      {sp.stand ? (
                        <span className="block text-xs font-normal text-gray-400">
                          über alle Einheiten
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatCents(totalDue)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatCents(totalPaid)}</td>
                    <td
                      className={`py-2 pr-3 text-right font-semibold ${
                        totalPaid - totalDue < 0 ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {totalPaid - totalDue < 0 ? "−" : "+"}
                      {formatCents(Math.abs(totalPaid - totalDue))}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>

        {/* Mahnwesen — Karte hängt am Bestand, nicht am Filterergebnis: sonst
            verschwände mit dem letzten Treffer auch die Filterleiste. */}
        {mahnStufen.length > 0 ? (
          <Card title="Mahnwesen — erstellte Schreiben">
            <p className="mb-3 text-sm text-gray-500">
              PDF herunterladen, drucken/versenden und anschließend „als versendet markieren“ —
              erst versendete Schreiben schalten die nächste Mahnstufe frei. Keine automatischen
              Mahngebühren.
            </p>
            <FilterBar filters={[MAHN_FILTER]} pageParam="mseite" />
            {mahnungen.length === 0 ? (
              <EmptyState>
                {mahnstatus === "entwurf"
                  ? "Alle Schreiben sind versendet."
                  : "Noch kein Schreiben versendet."}
              </EmptyState>
            ) : null}
            <div className="grid gap-2">
              {mahnungen.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {reminderLevelLabel(m.level)} · {m.unit.label}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {formatCents(m.arrearsCents)} · zahlbar bis {formatDateOnly(m.paymentDeadline)}
                    </span>
                    <span className="block text-xs text-gray-400">
                      an {m.recipientName} · erstellt {formatDateOnly(m.createdAt)}
                      {m.sentAt ? ` · versendet ${formatDateOnly(m.sentAt)}` : " · noch nicht versendet"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/verwaltung/weg/${property.id}/hausgeld/mahnung/${m.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      PDF
                    </a>
                    {!m.sentAt ? (
                      <>
                        <form action={markMahnungSent}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="mahnungId" value={m.id} />
                          <PendingButton className={buttonSecondaryClass}>Als versendet markieren</PendingButton>
                        </form>
                        <form action={deleteMahnung}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="mahnungId" value={m.id} />
                          <ConfirmActionButton
                            className="text-xs text-red-600 underline"
                            confirmLabel="Wirklich löschen?"
                            pendingLabel="Wird gelöscht…"
                          >
                            Entwurf löschen
                          </ConfirmActionButton>
                        </form>
                      </>
                    ) : (
                      <Badge tone="success">versendet</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              currentPage={mPage}
              totalPages={Math.max(1, Math.ceil(mahnungTotal / MAHNUNG_PAGE_SIZE))}
              total={mahnungTotal}
              itemLabel="Schreiben"
              hrefFor={mahnungHref}
            />
          </Card>
        ) : null}

        {/* Zahlungseingänge zuordnen */}
        <Card title={`Zahlungseingänge zuordnen (${unassignedTotal} offen)`}>
          <FilterBar
            searchPlaceholder="Suchen"
            searchHint="In Buchungstext, Verwendungszweck und Zahler suchen"
          />
          {unassigned.length === 0 ? (
            <EmptyState>
              {q ? (
                "Kein offener Zahlungseingang passt zur Suche."
              ) : (
                <>
                  Keine offenen Zahlungseingänge — neue Eingänge entstehen durch Buchungen oder den
                  CSV-Bankimport in der{" "}
                  <Link href={`/verwaltung/weg/${property.id}/buchhaltung`} className="underline">
                    Buchhaltung
                  </Link>
                  .
                </>
              )}
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {unassigned.map((b) => {
                const suggestion = suggestUnit(b, units, unitByIban, unitByNachname);
                return (
                  <form
                    key={b.id}
                    action={assignPayment}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3"
                  >
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="bookingId" value={b.id} />
                    <div className="min-w-48 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {formatCents(b.amountCents)} · {formatDateOnly(b.bookingDate)}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {b.text}
                        {b.counterparty ? ` · ${b.counterparty}` : ""}
                      </span>
                    </div>
                    <select
                      name="unitId"
                      defaultValue={suggestion ?? ""}
                      className={`${inputClass} w-auto`}
                      aria-label="Einheit zuordnen"
                    >
                      <option value="">— Einheit wählen —</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                          {suggestion === u.id ? " (Vorschlag)" : ""}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className={buttonSecondaryClass}>
                      Zuordnen
                    </button>
                  </form>
                );
              })}
            </div>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={unassignedTotal}
            itemLabel="Zahlungseingänge"
            hrefFor={pageHref}
          />
        </Card>

        {/* Zugeordnete Zahlungen */}
        {assignedTotal > 0 ? (
          <Card title={`Zugeordnete Zahlungen (${assignedTotal})`}>
            <div className="grid gap-2">
              {assigned.map((b) => (
                (() => {
                  const angerechnet = b.allocations.reduce((s, a) => s + a.amountCents, 0);
                  const offen = b.amountCents - angerechnet;
                  return (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 text-sm"
                    >
                      <span className="text-gray-700">
                        {formatCents(b.amountCents)} · {formatDateOnly(b.bookingDate)} · {b.text} →{" "}
                        <span className="font-medium text-gray-900">{b.unit?.label}</span>
                        {/* Worauf angerechnet — die Frage, die „zugeordnet zu
                            Einheit X" offenlässt und die in der Mahnung zählt. */}
                        {angerechnet > 0 ? (
                          <span className="block text-xs text-gray-500">
                            angerechnet auf{" "}
                            {b.allocations
                              .map((a) =>
                                a.duePosting.source === "SONDERUMLAGE"
                                  ? `Sonderumlage (${formatCents(a.amountCents)})`
                                  : `${a.duePosting.periodMonth}/${a.duePosting.periodYear} (${formatCents(a.amountCents)})`,
                              )
                              .join(" · ")}
                          </span>
                        ) : null}
                        {offen > 0 ? (
                          <span className="block text-xs text-amber-600">
                            {formatCents(offen)} noch nicht angerechnet
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-3">
                        {offen > 0 ? (
                          <form action={ordneZahlungZu} className="flex items-center gap-1">
                            <input type="hidden" name="propertyId" value={property.id} />
                            <input type="hidden" name="bookingId" value={b.id} />
                            {/* § 366 Abs. 1 BGB: Steht im Verwendungszweck, worauf
                                gezahlt wird, geht das der gesetzlichen Reihenfolge
                                vor. Den Fließtext liest der Verwalter, nicht das
                                Programm — eine Fehldeutung verschöbe echtes Geld. */}
                            <SelectField
                              name="zweck"
                              defaultValue="ALLE"
                              className="w-auto text-xs"
                              aria-label="Tilgungsbestimmung laut Verwendungszweck"
                              options={[
                                { value: "ALLE", label: "ohne Angabe (älteste zuerst)" },
                                { value: "WIRTSCHAFTSPLAN", label: "laut Zweck: Hausgeld" },
                                { value: "SONDERUMLAGE", label: "laut Zweck: Sonderumlage" },
                              ]}
                            />
                            <PendingButton className="text-xs text-gray-700 underline">
                              anrechnen
                            </PendingButton>
                          </form>
                        ) : null}
                        {angerechnet > 0 ? (
                          <form action={loeseZuordnung}>
                            <input type="hidden" name="propertyId" value={property.id} />
                            <input type="hidden" name="bookingId" value={b.id} />
                            <PendingButton className="text-xs text-gray-500 underline">
                              Anrechnung lösen
                            </PendingButton>
                          </form>
                        ) : null}
                        <form action={assignPayment}>
                          <input type="hidden" name="propertyId" value={property.id} />
                          <input type="hidden" name="bookingId" value={b.id} />
                          <input type="hidden" name="unitId" value="" />
                          <PendingButton className="text-xs text-red-600 underline">
                            Zuordnung lösen
                          </PendingButton>
                        </form>
                      </span>
                    </div>
                  );
                })()
              ))}
            </div>

            <Pagination
              currentPage={aPage}
              totalPages={Math.max(1, Math.ceil(assignedTotal / ASSIGNED_PAGE_SIZE))}
              total={assignedTotal}
              itemLabel="Zahlungen"
              hrefFor={assignedHref}
            />
          </Card>
        ) : null}
      </div>
    </>
  );
}
