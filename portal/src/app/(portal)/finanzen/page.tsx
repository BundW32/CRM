import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, PageTitle, Pagination, buttonSecondaryClass, inputClass } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import { isBoardMemberOf, ownedUnitIdsInProperty, wegPropertiesForOwner } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { formatCents } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import type { StatementView } from "@/lib/weg/statement-service";
import { setBeiratReview } from "../beirat/review-actions";

const REVIEW_LABEL = { GEPRUEFT: "geprüft", ANMERKUNGEN: "mit Anmerkungen" } as const;

const BOOKINGS_PAGE_SIZE = 50;

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

  // ── Belegeinsicht: Suche und Jahr, paginiert ──
  const bPage = parsePage(sp.page);
  const bq = normalizeSearch(sp.bq);
  const bJahr = /^\d{4}$/.test(sp.bjahr ?? "") ? Number(sp.bjahr) : undefined;
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
  const bookingWhere: Prisma.BookingWhereInput = { AND: bookingAnd };

  const [statements, plans, myUnits, dueSums, paidSums, bookings, bookingTotal] = await Promise.all([
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
    db.booking.findMany({
      where: bookingWhere,
      include: { account: { select: { name: true } }, costType: { select: { name: true } } },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      skip: (bPage - 1) * BOOKINGS_PAGE_SIZE,
      take: BOOKINGS_PAGE_SIZE,
    }),
    db.booking.count({ where: bookingWhere }),
  ]);

  // Jahres-Auswahl aus dem Bestand ableiten (keine leeren Jahrgänge).
  const oldestBooking = await db.booking.findFirst({
    where: { propertyId: selected.id },
    orderBy: { bookingDate: "asc" },
    select: { bookingDate: true },
  });
  const currentYear = new Date().getFullYear();
  const startYear = oldestBooking ? oldestBooking.bookingDate.getFullYear() : currentYear;
  const belegFilters: FilterConfig[] = [
    {
      key: "bjahr",
      label: "Jahr",
      allLabel: "Alle Jahre",
      primary: true,
      options: Array.from({ length: currentYear - startYear + 1 }, (_, i) => {
        const y = currentYear - i;
        return { value: String(y), label: String(y) };
      }),
    },
  ];

  // Blättern in der Belegeinsicht erhält Objektauswahl und Filter.
  function bookingPageHref(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
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
                      <a
                        href={`/finanzen/abrechnung/${s.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonSecondaryClass}
                      >
                        Meine Einzelabrechnung als PDF
                      </a>
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
                      <a
                        href={`/finanzen/wirtschaftsplan/${p.id}/pdf?dokument=einzelplan`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonSecondaryClass}
                      >
                        Mein Hausgeld im Detail
                      </a>
                      <a
                        href={`/finanzen/wirtschaftsplan/${p.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonSecondaryClass}
                      >
                        Gesamtplan als PDF
                      </a>
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
          />
          <p className="mb-3 px-1 text-xs text-gray-400">
            {bookingTotal} {bookingTotal === 1 ? "Buchung" : "Buchungen"}
            {bq || bJahr ? " (gefiltert)" : ""}
          </p>

          {bookings.length === 0 ? (
            <EmptyState>
              {bq || bJahr ? "Keine Buchungen gefunden." : "Noch keine Buchungen erfasst."}
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
                        <td className="py-2 pr-3 text-gray-900">{b.text}</td>
                        <td className="py-2 pr-3 text-gray-600">{b.costType?.name ?? "—"}</td>
                        <td
                          className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                            sign < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {sign < 0 ? "−" : "+"}
                          {euro(b.amountCents)}
                        </td>
                        <td className="py-2">
                          {b.belegStoredName ? (
                            <a
                              href={`/api/files/beleg/${b.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm underline"
                            >
                              ansehen
                            </a>
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

          <Pagination
            currentPage={bPage}
            totalPages={Math.max(1, Math.ceil(bookingTotal / BOOKINGS_PAGE_SIZE))}
            total={bookingTotal}
            itemLabel="Buchungen"
            hrefFor={bookingPageHref}
          />
        </Card>
      </div>
    </>
  );
}
