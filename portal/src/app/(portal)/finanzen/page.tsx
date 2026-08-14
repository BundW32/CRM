import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, PageTitle, Pagination, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Badge, KeyFigure, KeyFigures } from "@/components/data-display";
import { FilterBar, SortControl, type FilterConfig, type SortOption } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import { isBoardMemberOf, ownedUnitIdsInProperty, wegPropertiesForOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { bookingKindLabels, formatDateOnly, ledgerAccountKindLabels } from "@/lib/labels";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import type { StatementView } from "@/lib/weg/statement-service";
import { setBeiratReview } from "../beirat/review-actions";
import { FilePreviewLink } from "@/components/file-preview-link";

const REVIEW_LABEL = { GEPRUEFT: "geprüft", ANMERKUNGEN: "mit Anmerkungen" } as const;

const BOOKINGS_PAGE_SIZE = 50;

// Sortierfelder als Whitelist – niemals ein Feld direkt aus der URL in `orderBy`.
const BELEG_SORT_FIELDS = { datum: "bookingDate", betrag: "amountCents" } as const;

const BELEG_SORT_OPTIONS: SortOption[] = [
  { value: "datum", label: "Datum" },
  { value: "betrag", label: "Betrag" },
];

/**
 * Obergrenze der gruppierten Ansicht.
 *
 * Sie lädt die Einzelbuchungen aller Kostenarten auf einmal, damit sich jede
 * Gruppe ohne Nachladen aufklappen lässt. Für ein Wirtschaftsjahr einer WEG ist
 * das reichlich bemessen; wird sie doch erreicht, sagt die Ansicht das (die
 * Summen darüber bleiben vollständig, sie kommen aus der Datenbank).
 */
const GRUPPEN_MAX = 2000;

/** Ein Tagesdatum aus der URL (`YYYY-MM-DD`) als lokale Mitternacht. */
function parseTag(raw: string | undefined): Date | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const [jahr, monat, tag] = raw.split("-").map(Number);
  const datum = new Date(jahr, monat - 1, tag);
  return Number.isNaN(datum.getTime()) ? undefined : datum;
}

// Prüfvermerk des Beirats (§ 29 III WEG): Status für alle Eigentümer sichtbar;
// Beiratsmitglieder können ihn setzen/ändern.
function ReviewBlock({
  kind,
  id,
  status,
  note,
  canReview,
  back,
}: {
  kind: "plan" | "statement";
  id: string;
  status: "GEPRUEFT" | "ANMERKUNGEN" | null;
  note: string | null;
  canReview: boolean;
  back: string;
}) {
  if (!status && !canReview) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-500">Prüfvermerk des Beirats</p>
      {status ? (
        <p className="mt-1 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              status === "GEPRUEFT" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {REVIEW_LABEL[status]}
          </span>
          {note ? <span className="ml-2 text-gray-600">{note}</span> : null}
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Noch nicht geprüft.</p>
      )}
      {canReview ? (
        <form action={setBeiratReview} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="back" value={back} />
          <select name="status" required defaultValue={status ?? ""} className={`${inputClass} w-auto`}>
            <option value="" disabled>
              – Vermerk –
            </option>
            <option value="GEPRUEFT">geprüft</option>
            <option value="ANMERKUNGEN">mit Anmerkungen</option>
          </select>
          <input
            type="text"
            name="note"
            defaultValue={note ?? ""}
            placeholder="Anmerkung (optional)"
            className={`${inputClass} w-auto flex-1`}
          />
          <SubmitButton className={buttonSecondaryClass} pendingLabel="…">
            Vermerk speichern
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";

// Eigentümer-Finanzansicht (Belegeinsicht, § WEG): jeder Eigentümer sieht seine
// eigene Jahresabrechnung, seinen Hausgeld-Saldo und – als Ersatz für den
// „Ordner-Termin" – die Belege der WEG-Buchhaltung. Reine Leseansicht.
export default async function FinanzenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER") redirect("/dashboard");
  const sp = await searchParams;
  const { objekt } = sp;

  const wegProps = await wegPropertiesForOwner(user.id, user.organizationId);
  if (wegProps.length === 0) {
    return (
      <>
        <PageTitle>Finanzen</PageTitle>
        <Card>
          <EmptyState>
            Für Sie ist aktuell keine Wohnungseigentümergemeinschaft mit Finanzdaten hinterlegt.
          </EmptyState>
        </Card>
      </>
    );
  }
  const selected = wegProps.find((p) => p.id === objekt) ?? wegProps[0];
  const now = new Date();

  const myUnitIds = await ownedUnitIdsInProperty(user.id, selected.id);
  // Beiratsmitglied dieses Objekts? Dann darf es den Prüfvermerk setzen.
  const canReview = await isBoardMemberOf(user.id, selected.id);
  const backTo = `/finanzen?objekt=${encodeURIComponent(selected.id)}`;

  // ── Belegeinsicht: Filter, Sortierung, Summen ──
  //
  // Ausgangspunkt bleibt IMMER `{ propertyId: selected.id }` — das Objekt aus
  // `wegPropertiesForOwner`, also der Scope dieses Eigentümers. Jeder Filter
  // hängt sich als weitere Bedingung an dieses `AND` und kann die Menge damit
  // nur verengen, nie erweitern.
  const bPage = parsePage(sp.page);
  const bq = normalizeSearch(sp.bq);
  const bJahr = /^\d{4}$/.test(sp.bjahr ?? "") ? Number(sp.bjahr) : undefined;
  const bSort = resolveSort(sp.sort, sp.dir, BELEG_SORT_FIELDS, "datum");
  const gruppiert = sp.bansicht === "kostenart";

  // Auswahllisten und Jahresspanne vorab: Die Kostenart aus der URL wird gegen
  // den Bestand DIESES Objekts geprüft, damit die Filterleiste keinen rohen
  // Fremdschlüssel als Etikett anzeigt.
  const [costTypes, oldestBooking] = await Promise.all([
    db.costType.findMany({
      where: { propertyId: selected.id },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.booking.findFirst({
      where: { propertyId: selected.id },
      orderBy: { bookingDate: "asc" },
      select: { bookingDate: true },
    }),
  ]);

  const bKostenart = costTypes.some((c) => c.id === sp.bkostenart) ? sp.bkostenart : undefined;
  const bKonto = sp.bkonto === "GIRO" || sp.bkonto === "RUECKLAGE" ? sp.bkonto : undefined;
  const bArt =
    sp.bart === "EINNAHME" || sp.bart === "AUSGABE" || sp.bart === "UMBUCHUNG" ? sp.bart : undefined;
  const bVon = parseTag(sp.bvon);
  const bBis = parseTag(sp.bbis);
  const bNurBeleg = sp.bbeleg === "ja";
  const bOhneStorno = sp.bstorno === "ohne";

  const bookingAnd: Prisma.BookingWhereInput[] = [{ propertyId: selected.id }];
  if (bq) {
    bookingAnd.push({
      OR: [
        { text: { contains: bq, mode: "insensitive" } },
        { reference: { contains: bq, mode: "insensitive" } },
        { counterparty: { contains: bq, mode: "insensitive" } },
      ],
    });
  }
  if (bJahr) {
    bookingAnd.push({
      bookingDate: { gte: new Date(bJahr, 0, 1), lt: new Date(bJahr + 1, 0, 1) },
    });
  }
  if (bVon) bookingAnd.push({ bookingDate: { gte: bVon } });
  // Der „bis"-Tag gehört mit dazu: Wer den 31.12. eingibt, meint ihn
  // einschließlich — deshalb bis zum Beginn des Folgetags.
  if (bBis) bookingAnd.push({ bookingDate: { lt: new Date(bBis.getTime() + 86_400_000) } });
  if (bKostenart) bookingAnd.push({ costTypeId: bKostenart });
  if (bKonto) bookingAnd.push({ account: { kind: bKonto } });
  if (bArt) bookingAnd.push({ kind: bArt });
  if (bNurBeleg) bookingAnd.push({ belegStoredName: { not: null } });
  // Stornierte Buchungen sind standardmäßig SICHTBAR (§ 18 Abs. 4 WEG, siehe
  // die Abfrage unten). Dieser Filter blendet sie auf Wunsch aus — die Vorgabe
  // ändert er nicht.
  if (bOhneStorno) bookingAnd.push(NOT_REVERSED);

  const bookingWhere: Prisma.BookingWhereInput = { AND: bookingAnd };
  // Für die Summen fällt das Stornopaar immer heraus, unabhängig vom Filter:
  // Das Storno einer Ausgabe ist eine Einnahme (siehe `booking-scope.ts`) und
  // erschiene sonst als Geldeingang, den es nie gab.
  const summenWhere: Prisma.BookingWhereInput = { AND: [...bookingAnd, NOT_REVERSED] };

  const belegGefiltert = Boolean(
    bq || bJahr || bKostenart || bKonto || bArt || bVon || bBis || bNurBeleg || bOhneStorno,
  );

  const [statements, plans, myUnits, dueSums, paidSums, bookings, bookingTotal, belegSummen] = await Promise.all([
    db.annualStatement.findMany({
      where: { propertyId: selected.id, status: "FERTIG" },
      orderBy: { year: "desc" },
    }),
    // Beschlossene Wirtschaftspläne (Entwürfe sind Verwalter-Arbeitsstände).
    db.economicPlan.findMany({
      where: { propertyId: selected.id, status: "BESCHLOSSEN" },
      orderBy: { year: "desc" },
      select: {
        id: true,
        year: true,
        resolvedAt: true,
        resolutionNote: true,
        beiratReviewStatus: true,
        beiratReviewNote: true,
      },
    }),
    db.unit.findMany({
      where: { id: { in: myUnitIds } },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    }),
    db.duePosting.groupBy({
      by: ["unitId"],
      where: { unitId: { in: myUnitIds }, dueDate: { lte: now } },
      _sum: { amountCents: true },
    }),
    db.booking.groupBy({
      by: ["unitId"],
      where: { unitId: { in: myUnitIds }, kind: "EINNAHME", ...NOT_REVERSED },
      _sum: { amountCents: true },
    }),
    // Belegeinsicht: alle Buchungen der WEG (Leserecht der Gemeinschaft).
    // Paginiert statt gedeckelt – das Leserecht umfasst den ganzen Bestand.
    // In der gruppierten Ansicht entfällt diese Abfrage; dort wird nach
    // Kostenart geladen.
    gruppiert
      ? Promise.resolve([])
      : db.booking.findMany({
          where: bookingWhere,
          include: {
            account: { select: { name: true } },
            costType: { select: { name: true } },
            // Storno wird **nicht** herausgefiltert: Das Einsichtsrecht nach § 18
            // Abs. 4 WEG umfasst den vollständigen Bestand, und eine Buchhaltung,
            // aus der etwas verschwindet, ist keine. Gezeigt werden muss aber, dass
            // sie neutralisiert ist — sonst zählt der Eigentümer eine Ausgabe mit,
            // die es nicht gab, und zwar zweimal: einmal das Original, einmal die
            // Gegenbuchung. Ein Filter darf sie ausblenden (`bstorno`), die
            // Vorgabe nicht.
            reversedBy: { select: { id: true } },
            reversalOf: { select: { id: true, text: true } },
          },
          orderBy: [toOrderBy(bSort.field, bSort.dir), { createdAt: "desc" }],
          skip: (bPage - 1) * BOOKINGS_PAGE_SIZE,
          take: BOOKINGS_PAGE_SIZE,
        }),
    db.booking.count({ where: bookingWhere }),
    // Summen über das GESAMTE Filterergebnis, nicht über die sichtbare Seite:
    // Eine gefilterte Liste ohne Summe ist nur eine kürzere Liste.
    db.booking.groupBy({
      by: ["kind"],
      where: summenWhere,
      _sum: { amountCents: true },
    }),
  ]);

  const summeJeArt = (art: "EINNAHME" | "AUSGABE" | "UMBUCHUNG") =>
    belegSummen.find((s) => s.kind === art)?._sum.amountCents ?? 0;
  const einnahmen = summeJeArt("EINNAHME");
  const ausgaben = summeJeArt("AUSGABE");
  const belegSaldo = einnahmen - ausgaben;
  // Umbuchungen zählen NICHT in den Saldo: Sie verschieben Geld zwischen den
  // Konten der Gemeinschaft (Giro → Rücklage) und sind weder Einnahme noch
  // Aufwand. Erwähnt werden sie trotzdem — sonst fehlten sie in der Summe,
  // ohne dass jemand erführe, warum.
  const umbuchungen = summeJeArt("UMBUCHUNG");

  // ── Ansicht „nach Kostenart gruppiert" ─────────────────────────────────────
  // Die Frage, die ein Eigentümer wirklich hat, lautet nicht „welche Buchung
  // war das am 14. März", sondern „was hat die Gemeinschaft dieses Jahr für
  // Versicherung ausgegeben". Dafür die Summe je Kostenart, und darunter
  // aufklappbar die Buchungen, aus denen sie besteht.
  //
  // Stornopaare fallen hier heraus — anders als in der Liste. Das Storno einer
  // Ausgabe ist eine Einnahme; stünde es mit drin, wiese die Kostenart Kosten
  // aus, die es nicht gab. Die Liste daneben zeigt weiterhin den vollständigen
  // Bestand, das Einsichtsrecht bleibt also unberührt.
  const gruppenWhere: Prisma.BookingWhereInput = {
    AND: [...bookingAnd, NOT_REVERSED, { kind: { in: ["EINNAHME", "AUSGABE"] } }],
  };
  const [gruppenSummen, gruppenBuchungen] = gruppiert
    ? await Promise.all([
        db.booking.groupBy({
          by: ["costTypeId", "kind"],
          where: gruppenWhere,
          _sum: { amountCents: true },
          _count: { _all: true },
        }),
        db.booking.findMany({
          where: gruppenWhere,
          select: {
            id: true,
            bookingDate: true,
            text: true,
            counterparty: true,
            amountCents: true,
            kind: true,
            costTypeId: true,
            belegStoredName: true,
            account: { select: { name: true } },
          },
          orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
          take: GRUPPEN_MAX,
        }),
      ])
    : [[], []];

  const kostenartName = new Map(costTypes.map((c) => [c.id, c.name]));
  const gruppen = gruppiert
    ? [...new Set(gruppenSummen.map((s) => s.costTypeId))]
        .map((costTypeId) => {
          const zeilen = gruppenSummen.filter((s) => s.costTypeId === costTypeId);
          const summe = (art: "EINNAHME" | "AUSGABE") =>
            zeilen.find((z) => z.kind === art)?._sum.amountCents ?? 0;
          return {
            id: costTypeId,
            name: costTypeId
              ? (kostenartName.get(costTypeId) ?? "Unbekannte Kostenart")
              : "Ohne Kostenart",
            ausgaben: summe("AUSGABE"),
            einnahmen: summe("EINNAHME"),
            anzahl: zeilen.reduce((n, z) => n + z._count._all, 0),
            buchungen: gruppenBuchungen.filter((b) => b.costTypeId === costTypeId),
          };
        })
        // Die größte Ausgabe zuerst — danach fragt man zuerst. „Ohne
        // Kostenart" ans Ende: Das ist ein Arbeitsstand der Verwaltung, keine
        // Antwort auf eine Frage des Eigentümers.
        .sort((x, y) => (x.id === null ? 1 : y.id === null ? -1 : y.ausgaben - x.ausgaben))
    : [];
  const gruppenAnzahl = gruppen.reduce((n, g) => n + g.anzahl, 0);
  const gruppenGekappt = gruppenAnzahl > gruppenBuchungen.length;

  // Jahres-Auswahl aus dem Bestand ableiten (keine leeren Jahrgänge).
  const currentYear = new Date().getFullYear();
  const startYear = oldestBooking ? oldestBooking.bookingDate.getFullYear() : currentYear;
  const jahre = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);
  const belegFilters: FilterConfig[] = [
    {
      key: "bjahr",
      label: "Jahr",
      allLabel: "Alle Jahre",
      primary: true,
      options: jahre.map((y) => ({ value: String(y), label: String(y) })),
    },
    {
      key: "bkostenart",
      label: "Kostenart",
      allLabel: "Alle Kostenarten",
      primary: true,
      options: costTypes.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "bkonto",
      label: "Konto",
      allLabel: "Beide Konten",
      options: (["GIRO", "RUECKLAGE"] as const).map((k) => ({
        value: k,
        label: ledgerAccountKindLabels[k],
      })),
    },
    {
      key: "bart",
      label: "Art",
      allLabel: "Alle Arten",
      options: (Object.keys(bookingKindLabels) as Array<keyof typeof bookingKindLabels>).map((k) => ({
        value: k,
        label: bookingKindLabels[k],
      })),
    },
    {
      key: "bbeleg",
      label: "Beleg",
      allLabel: "Mit und ohne Beleg",
      options: [{ value: "ja", label: "Nur mit Beleg" }],
    },
    {
      // Stornierte Buchungen bleiben sichtbar (§ 18 Abs. 4 WEG). Wer beim
      // Durchsehen einer Kostenart nur das Wirksame sehen will, blendet sie
      // hier aus — die Vorgabe bleibt „mit stornierten".
      key: "bstorno",
      label: "Stornos",
      allLabel: "Mit stornierten",
      options: [{ value: "ohne", label: "Ohne stornierte" }],
    },
  ];

  // Blättern in der Belegeinsicht erhält Objektauswahl, Filter und Sortierung.
  const bookingPageHref = pageHrefFor("/finanzen", sp);

  /** Umschalter Liste ↔ gruppiert; alle übrigen Filter bleiben stehen. */
  function ansichtHref(ansicht: "liste" | "kostenart") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "bansicht" && k !== "page") params.set(k, v);
    }
    if (ansicht === "kostenart") params.set("bansicht", "kostenart");
    const qs = params.toString();
    return `/finanzen${qs ? `?${qs}` : ""}`;
  }

  const dueByUnit = new Map(dueSums.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
  const paidByUnit = new Map(paidSums.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));

  // Beirat-Einsicht: vollständige Rückstandsliste ALLER Einheiten (normale
  // Eigentümer sehen nur ihre eigene). Nur für Beiratsmitglieder geladen.
  let boardRueckstaende: { id: string; label: string; soll: number; ist: number; saldo: number }[] | null = null;
  if (canReview) {
    const allUnits = await db.unit.findMany({
      where: { propertyId: selected.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    });
    const allUnitIds = allUnits.map((u) => u.id);
    const [allDue, allPaid] = await Promise.all([
      db.duePosting.groupBy({
        by: ["unitId"],
        where: { unitId: { in: allUnitIds }, dueDate: { lte: now } },
        _sum: { amountCents: true },
      }),
      db.booking.groupBy({
        by: ["unitId"],
        where: { unitId: { in: allUnitIds }, kind: "EINNAHME", ...NOT_REVERSED },
        _sum: { amountCents: true },
      }),
    ]);
    const dm = new Map(allDue.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
    const pm = new Map(allPaid.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));
    boardRueckstaende = allUnits.map((u) => {
      const soll = dm.get(u.id) ?? 0;
      const ist = pm.get(u.id) ?? 0;
      return { id: u.id, label: u.label, soll, ist, saldo: soll - ist };
    });
  }

  const euro = (c: number) => formatCents(c);

  return (
    <>
      <PageTitle>Finanzen · {selected.name}</PageTitle>

      {wegProps.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {wegProps.map((p) => (
            <Link
              key={p.id}
              href={`/finanzen?objekt=${p.id}`}
              className={`rounded-full px-3 py-1 text-sm ${
                p.id === selected.id ? "bg-brand-green text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        {/* Meine Jahresabrechnungen */}
        <Card title="Meine Jahresabrechnungen">
          {statements.length === 0 ? (
            <EmptyState>Noch keine fertiggestellte Jahresabrechnung.</EmptyState>
          ) : myUnitIds.length === 0 ? (
            <Alert variant="info">
              Ihnen ist in diesem Objekt noch keine Einheit zugeordnet — bitte wenden Sie sich an
              die Verwaltung.
            </Alert>
          ) : (
            <div className="grid gap-3">
              {statements.map((s) => {
                const view = s.snapshot as unknown as StatementView | null;
                return (
                  <div key={s.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">Wirtschaftsjahr {s.year}</span>
                      <span className="text-xs text-gray-400">
                        fertiggestellt {s.finalizedAt ? formatDateOnly(s.finalizedAt) : ""}
                      </span>
                    </div>
                    {view
                      ? myUnits.map((u) => {
                          const total = view.perUnitTotal?.[u.id] ?? 0;
                          const peak = view.peak?.[u.id] ?? 0;
                          const labor = view.labor?.[u.id];
                          return (
                            <div key={u.id} className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-100 pt-2">
                              <div>
                                <span className="text-sm font-medium text-gray-800">{u.label}</span>
                                <span className="ml-2 text-sm text-gray-500">
                                  Kostenanteil {euro(total)}
                                </span>
                                {labor && (labor.haushaltsnah > 0 || labor.handwerker > 0) ? (
                                  <span className="ml-2 text-xs text-gray-400">
                                    §35a: {euro(labor.haushaltsnah)} haushaltsnah ·{" "}
                                    {euro(labor.handwerker)} Handwerker
                                  </span>
                                ) : null}
                                {/* Die Lücke gehört dem Eigentümer gesagt — es
                                    ist Geld, das er absetzen könnte, sobald der
                                    Lohnanteil der Rechnung vorliegt. */}
                                {labor && labor.unerfasst > 0 ? (
                                  <span className="ml-2 text-xs text-amber-600">
                                    für {euro(labor.unerfasst)} liegt kein Lohnanteil vor
                                  </span>
                                ) : null}
                              </div>
                              <span
                                className={`text-sm font-semibold ${
                                  peak > 0 ? "text-red-700" : peak < 0 ? "text-green-700" : "text-gray-700"
                                }`}
                              >
                                {peak > 0 ? "Nachschuss " : peak < 0 ? "Guthaben " : ""}
                                {euro(Math.abs(peak))}
                              </span>
                            </div>
                          );
                        })
                      : null}
                    <div className="mt-3">
                      <FilePreviewLink
                        src={`/finanzen/abrechnung/${s.id}/pdf`}
                        title={`Meine Einzelabrechnung ${s.year}`}
                        className={buttonSecondaryClass}
                      >
                        Meine Einzelabrechnung als PDF
                      </FilePreviewLink>
                    </div>
                    <ReviewBlock
                      kind="statement"
                      id={s.id}
                      status={s.beiratReviewStatus}
                      note={s.beiratReviewNote}
                      canReview={canReview}
                      back={backTo}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Wirtschaftsplan (beschlossen) */}
        <Card title="Wirtschaftsplan">
          {plans.length === 0 ? (
            <EmptyState>Noch kein beschlossener Wirtschaftsplan.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-gray-900">Wirtschaftsjahr {p.year}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        beschlossen{p.resolvedAt ? ` ${formatDateOnly(p.resolvedAt)}` : ""}
                        {p.resolutionNote ? ` · ${p.resolutionNote}` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {/* Der eigene Einzelplan zuerst: Er beantwortet die Frage,
                          die der Eigentümer wirklich hat — woraus sich mein
                          Hausgeld zusammensetzt. */}
                      <FilePreviewLink
                        src={`/finanzen/wirtschaftsplan/${p.id}/pdf?dokument=einzelplan`}
                        title={`Mein Einzelwirtschaftsplan ${p.year}`}
                        className={buttonSecondaryClass}
                      >
                        Mein Hausgeld im Detail
                      </FilePreviewLink>
                      <FilePreviewLink
                        src={`/finanzen/wirtschaftsplan/${p.id}/pdf`}
                        title={`Wirtschaftsplan ${p.year}`}
                        className={buttonSecondaryClass}
                      >
                        Gesamtplan als PDF
                      </FilePreviewLink>
                    </div>
                  </div>
                  <ReviewBlock
                    kind="plan"
                    id={p.id}
                    status={p.beiratReviewStatus}
                    note={p.beiratReviewNote}
                    canReview={canReview}
                    back={backTo}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Mein Hausgeld */}
        {myUnits.length > 0 ? (
          <Card title="Mein Hausgeld (Stand heute)">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Soll (fällig)</th>
                    <th className="py-2 pr-3 text-right">Gezahlt</th>
                    <th className="py-2 pr-3 text-right">Saldo</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {myUnits.map((u) => {
                    const due = dueByUnit.get(u.id) ?? 0;
                    const paid = paidByUnit.get(u.id) ?? 0;
                    const saldo = paid - due;
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{u.label}</td>
                        <td className="py-2 pr-3 text-right">{euro(due)}</td>
                        <td className="py-2 pr-3 text-right">{euro(paid)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-semibold ${
                            saldo < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {saldo < 0 ? "−" : saldo > 0 ? "+" : ""}
                          {euro(Math.abs(saldo))}
                          {saldo < 0 ? <span className="block text-xs font-normal text-red-500">offen</span> : null}
                        </td>
                        {/* Zwei Summen sagen nicht, WORAN es liegt. Der Auszug
                            führt jede Forderung und jede Zahlung einzeln auf —
                            was gemahnt wird, muss der Gemahnte prüfen können. */}
                        <td className="py-2 text-right whitespace-nowrap">
                          <Link
                            href={`/finanzen/kontoauszug/${u.id}`}
                            className="text-sm underline"
                          >
                            Kontoauszug
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {/* Rückstände aller Einheiten – nur für den Beirat (§ 29 WEG). */}
        {boardRueckstaende ? (
          <Card title="Rückstände aller Einheiten (Beirat-Einsicht)">
            <p className="mb-3 text-sm text-gray-500">
              Vollständige Übersicht Soll/Ist je Einheit zur Rechnungsprüfung. Nur für
              Beiratsmitglieder sichtbar.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Einheit</th>
                    <th className="py-2 pr-3 text-right">Soll (fällig)</th>
                    <th className="py-2 pr-3 text-right">Ist (gezahlt)</th>
                    <th className="py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {boardRueckstaende.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pr-3 text-gray-800">{r.label}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">{euro(r.soll)}</td>
                      <td className="py-2 pr-3 text-right text-gray-600">{euro(r.ist)}</td>
                      <td
                        className={`py-2 text-right font-semibold ${
                          r.saldo > 0 ? "text-red-700" : r.saldo < 0 ? "text-green-700" : "text-gray-700"
                        }`}
                      >
                        {r.saldo > 0 ? "Rückstand " : r.saldo < 0 ? "Guthaben " : ""}
                        {euro(Math.abs(r.saldo))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {/* Belegeinsicht */}
        <Card title="Belegeinsicht — Buchhaltung der Gemeinschaft">
          <p className="mb-3 text-sm text-gray-500">
            Als Eigentümer können Sie alle Buchungen Ihrer Gemeinschaft einsehen und die
            hinterlegten Belege öffnen — die digitale Belegeinsicht ersetzt den Ordner-Termin.
          </p>
          <FilterBar
            className="mb-3"
            searchParamKey="bq"
            searchPlaceholder="Suchen"
            searchHint="Nach Text, Verwendungszweck oder Zahlungspartner suchen"
            filters={belegFilters}
            dateRange={{ fromKey: "bvon", toKey: "bbis", label: "Zeitraum" }}
          />

          {/* Summenzeile über das FILTERERGEBNIS, nicht über die Seite. Ohne
              sie ist eine gefilterte Liste nur eine kürzere Liste: Man sieht
              alle Rechnungen der Kostenart „Versicherung", aber nicht, was sie
              zusammen gekostet haben. */}
          <div className="mb-4 rounded-xl bg-gray-50 p-4">
            <KeyFigures>
              <KeyFigure label="Einnahmen" value={euro(einnahmen)} tone="good" />
              <KeyFigure label="Ausgaben" value={euro(ausgaben)} />
              <KeyFigure
                label="Saldo"
                value={`${belegSaldo < 0 ? "−" : belegSaldo > 0 ? "+" : ""}${euro(Math.abs(belegSaldo))}`}
                tone={belegSaldo < 0 ? "warn" : "good"}
              />
            </KeyFigures>
            <p className="mt-3 text-xs text-gray-500">
              {belegGefiltert ? "Über das Filterergebnis" : "Über alle Buchungen dieser Gemeinschaft"}
              {" · ohne stornierte Buchungen und ihre Gegenbuchungen — sie heben sich auf"}
              {umbuchungen > 0
                ? ` · ${euro(umbuchungen)} Umbuchungen zwischen Giro und Rücklage bleiben außen vor (sie verschieben Geld, sie kosten keines)`
                : ""}
              .
            </p>
          </div>

          {/* Zwei Blickwinkel auf denselben, gefilterten Bestand: die
              zeitliche Liste („was ist passiert") und die Summe je Kostenart
              („wofür ist das Geld gegangen"). Die Filter gelten für beide. */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {([
                { wert: "liste", label: "Liste" },
                { wert: "kostenart", label: "Nach Kostenart" },
              ] as const).map((a) => (
                <Link
                  key={a.wert}
                  href={ansichtHref(a.wert)}
                  aria-current={(a.wert === "kostenart") === gruppiert ? "page" : undefined}
                  className={`rounded-full px-3 py-1 text-sm ${
                    (a.wert === "kostenart") === gruppiert
                      ? "bg-brand-green text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {a.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-400">
                {bookingTotal} {bookingTotal === 1 ? "Buchung" : "Buchungen"}
                {belegGefiltert ? " (gefiltert)" : ""}
              </p>
              {/* Blendet sich unter fünf Treffern selbst aus — die Grenze
                  steht in der Komponente, nicht hier. In der gruppierten
                  Ansicht ist die Reihenfolge durch die Summen vorgegeben. */}
              {gruppiert ? null : (
                <SortControl
                  sortOptions={BELEG_SORT_OPTIONS}
                  defaultSort="datum"
                  total={bookingTotal}
                />
              )}
            </div>
          </div>

          {gruppiert ? (
            gruppen.length === 0 ? (
              <EmptyState>
                {belegGefiltert
                  ? "Keine Einnahmen oder Ausgaben im Filterergebnis."
                  : "Noch keine Einnahmen oder Ausgaben erfasst."}
              </EmptyState>
            ) : (
              <div className="grid gap-2">
                <p className="text-xs text-gray-500">
                  {bJahr ? `Jahressummen ${bJahr}` : "Summen über alle gewählten Jahre"} je
                  Kostenart. Aufklappen zeigt die einzelnen Buchungen. Umbuchungen und
                  stornierte Buchungen bleiben hier außen vor — sie sind kein Aufwand; die
                  Liste daneben zeigt den vollständigen Bestand.
                </p>
                {gruppenGekappt ? (
                  <Alert variant="info">
                    Die Summen unten sind vollständig. Aufgeklappt werden die{" "}
                    {gruppenBuchungen.length} jüngsten von {gruppenAnzahl} Buchungen — grenzen
                    Sie den Zeitraum ein, um alle einzeln zu sehen.
                  </Alert>
                ) : null}
                {gruppen.map((g) => (
                  <details
                    key={g.id ?? "ohne"}
                    className="group rounded-xl border border-gray-200 p-3"
                    data-collapsible
                  >
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900">
                        {/* Ohne sichtbaren Pfeil sieht die Zeile aus wie eine
                            Zeile — dass sich dahinter die Einzelbuchungen
                            öffnen, errät niemand. Gleiche Optik wie
                            `CollapsibleCard`. */}
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                        {g.name}
                        <span className="text-xs font-normal text-gray-400">
                          {g.anzahl} {g.anzahl === 1 ? "Buchung" : "Buchungen"}
                        </span>
                      </span>
                      <span className="whitespace-nowrap">
                        {g.ausgaben > 0 ? (
                          <span className="font-semibold text-red-700">−{euro(g.ausgaben)}</span>
                        ) : null}
                        {g.einnahmen > 0 ? (
                          <span className="ml-3 font-semibold text-green-700">
                            +{euro(g.einnahmen)}
                          </span>
                        ) : null}
                      </span>
                    </summary>
                    <div className="mt-3 overflow-x-auto border-t border-gray-100 pt-3">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                            <th className="py-2 pr-3">Datum</th>
                            <th className="py-2 pr-3">Text</th>
                            <th className="py-2 pr-3">Konto</th>
                            <th className="py-2 pr-3 text-right">Betrag</th>
                            <th className="py-2">Beleg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.buchungen.map((b) => (
                            <tr key={b.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                                {formatDateOnly(b.bookingDate)}
                              </td>
                              <td className="py-2 pr-3 text-gray-900">
                                {b.text}
                                {b.counterparty ? (
                                  <span className="block text-xs text-gray-400">
                                    {b.counterparty}
                                  </span>
                                ) : null}
                              </td>
                              <td className="py-2 pr-3 text-gray-600">{b.account.name}</td>
                              <td
                                className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                                  b.kind === "AUSGABE" ? "text-red-700" : "text-green-700"
                                }`}
                              >
                                {b.kind === "AUSGABE" ? "−" : "+"}
                                {euro(b.amountCents)}
                              </td>
                              <td className="py-2">
                                {b.belegStoredName ? (
                                  <FilePreviewLink
                                    src={`/api/files/beleg/${b.id}`}
                                    title={`Beleg — ${b.text}`}
                                    className="text-sm underline"
                                  >
                                    ansehen
                                  </FilePreviewLink>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {g.buchungen.length < g.anzahl ? (
                            <tr>
                              <td colSpan={5} className="py-2 text-xs text-gray-400">
                                {g.anzahl - g.buchungen.length} weitere Buchungen dieser
                                Kostenart sind in den Summen enthalten, aber hier nicht
                                aufgeführt.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            )
          ) : bookings.length === 0 ? (
            <EmptyState>
              {belegGefiltert ? "Keine Buchungen gefunden." : "Noch keine Buchungen erfasst."}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Konto</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Kostenart</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2">Beleg</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const sign = b.kind === "EINNAHME" ? 1 : b.kind === "AUSGABE" ? -1 : b.transferOut ? -1 : 1;
                    return (
                      <tr key={b.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                          {formatDateOnly(b.bookingDate)}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{b.account.name}</td>
                        <td className="py-2 pr-3 text-gray-900">
                          {b.text}
                          {b.reversedBy ? (
                            <Badge tone="neutral" className="ml-2">
                              storniert
                            </Badge>
                          ) : null}
                          {b.reversalOf ? (
                            <Badge tone="neutral" className="ml-2">
                              Storno
                            </Badge>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{b.costType?.name ?? "—"}</td>
                        <td
                          className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                            b.reversedBy || b.reversalOf
                              ? "text-gray-400 line-through"
                              : sign < 0
                                ? "text-red-700"
                                : "text-green-700"
                          }`}
                        >
                          {sign < 0 ? "−" : "+"}
                          {euro(b.amountCents)}
                        </td>
                        <td className="py-2">
                          {b.belegStoredName ? (
                            <FilePreviewLink
                              src={`/api/files/beleg/${b.id}`}
                              title={`Beleg — ${b.text}`}
                              className="text-sm underline"
                            >
                              ansehen
                            </FilePreviewLink>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Geblättert wird nur die Liste; die gruppierte Ansicht zeigt alle
              Kostenarten auf einmal — genau das ist ihr Zweck. */}
          {gruppiert ? null : (
            <Pagination
              currentPage={bPage}
              totalPages={Math.max(1, Math.ceil(bookingTotal / BOOKINGS_PAGE_SIZE))}
              total={bookingTotal}
              itemLabel="Buchungen"
              hrefFor={bookingPageHref}
            />
          )}
        </Card>
      </div>
    </>
  );
}
