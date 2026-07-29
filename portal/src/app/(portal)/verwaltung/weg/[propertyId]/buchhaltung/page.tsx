import Link from "next/link";
import { FileInput } from "@/components/file-input";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import type { Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, Field, PageTitle, Pagination, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig, type SortOption } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { bookingKindLabels, formatDateOnly, ledgerAccountKindLabels } from "@/lib/labels";
import { normalizeSearch, parsePage, resolveSort, toOrderBy, pageHrefFor } from "@/lib/list-query";
import { formatCents } from "@/lib/money";
import { BauabzugHinweis } from "@/components/bauabzug-hinweis";
import { bauleistungenJeHandwerker } from "@/lib/weg/bauabzugsteuer-service";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { requireWegProperty } from "@/lib/weg/scope";
import { isDateLocked } from "@/lib/weg/statement-lock";
import {
  assignCostType,
  setLaborShare,
  createBooking,
  createTransfer,
  reverseBooking,
  undoImportBatch,
} from "./actions";
import { ImportClient } from "./ImportClient";
import { FilePreviewLink } from "@/components/file-preview-link";
import { DateField } from "@/components/fields";
import { Tipp } from "@/components/tipp";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Sortierfelder als Whitelist – niemals ein Feld direkt aus der URL in `orderBy`.
const SORT_FIELDS = { datum: "bookingDate", betrag: "amountCents" } as const;

const SORT_OPTIONS: SortOption[] = [
  { value: "datum", label: "Datum" },
  { value: "betrag", label: "Betrag" },
];

// Kontostand: Anfangsbestand + Σ EINNAHME − Σ AUSGABE ± UMBUCHUNGen
function balanceFor(
  account: { id: string; openingBalanceCents: number },
  sums: { accountId: string; kind: string; transferOut: boolean | null; _sum: { amountCents: number | null } }[],
): number {
  let balance = account.openingBalanceCents;
  for (const s of sums) {
    if (s.accountId !== account.id) continue;
    const amount = s._sum.amountCents ?? 0;
    if (s.kind === "EINNAHME") balance += amount;
    else if (s.kind === "AUSGABE") balance -= amount;
    else if (s.kind === "UMBUCHUNG") balance += s.transferOut ? -amount : amount;
  }
  return balance;
}

const FEHLER_TEXTE: Record<string, string> = {
  konto: "Bitte ein gültiges Konto auswählen.",
  betrag: "Der Betrag konnte nicht gelesen werden (Format: 1.234,56).",
  datum: "Das Datum konnte nicht gelesen werden.",
  kostenart: "Die gewählte Kostenart gehört nicht zu diesem Objekt.",
  lohnanteil:
    "Der Lohnanteil konnte nicht gelesen werden. Er gehört nur zu Ausgaben und darf den Rechnungsbetrag nicht übersteigen.",
  beleg: "Der Beleg konnte nicht gespeichert werden (erlaubt: Foto oder PDF).",
  gleicheskonto: "Quell- und Zielkonto müssen unterschiedlich sein.",
  mapping: "Bitte die Spalten für Datum, Betrag und Verwendungszweck zuordnen.",
  keinezeilen: "Die Datei enthält keine importierbaren Umsätze.",
  datei: "Die Datei konnte nicht verarbeitet werden.",
  keineauswahl: "Bitte zuerst Buchungen auswählen.",
  buchung: "Die Buchung wurde nicht gefunden oder kann keine Kostenart tragen.",
  abgeschlossen:
    "Das Wirtschaftsjahr ist abgeschlossen — für dieses Jahr liegt eine fertige Jahresabrechnung vor. Buchungen abgeschlossener Jahre bleiben unverändert.",
  schonstorniert: "Diese Buchung ist bereits storniert (oder ist selbst eine Stornobuchung).",
  handwerker: "Der gewählte Handwerker gehört nicht zu Ihrer Organisation.",
  // Nachträglich, also nach der Zahlung. Bewusst anders formuliert als die
  // Warnung im Buchungsformular: Einbehalten lässt sich hier nichts mehr, das
  // Geld ist überwiesen. Was bleibt, ist die Anmeldung und die Bescheinigung
  // fürs nächste Mal. Eine Meldung, die zum Einbehalt auffordert, wäre an
  // dieser Stelle schlicht nicht ausführbar.
  bauabzugnachtraeglich:
    "Zugeordnet — mit einem Hinweis: Für diesen Handwerker sind in diesem Kalenderjahr mehr als 5.000 € an Bauleistungen gebucht, ohne dass eine gültige Freistellungsbescheinigung vorliegt (§ 48 EStG). Die Zahlungen sind bereits erfolgt, einbehalten lässt sich nichts mehr. Fordern Sie die Bescheinigung an und sprechen Sie den Fall mit Ihrem Steuerberater durch.",
  // Nicht „Fehler bei der Eingabe", sondern die Handlungsanweisung: Der Nutzer
  // hat nichts falsch getippt, er soll etwas tun (LP2).
  bauabzugsteuer:
    "Für diese Bauleistung greift die Bauabzugsteuer (§ 48 EStG): Der Handwerker hat keine gültige Freistellungsbescheinigung, und die Gemeinschaft zahlt ihm dieses Jahr mehr als 5.000 €. Fordern Sie die Bescheinigung an und tragen Sie sie beim Handwerker ein — oder behalten Sie 15 % ein und bestätigen Sie das Kästchen im Formular.",
  import: "Der Import wurde nicht gefunden.",
  importstorniert:
    "Zu diesem Import gibt es bereits Stornobuchungen — er kann nicht mehr im Ganzen zurückgenommen werden.",
};

export default async function WegBuchhaltungPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  // ── Filter ────────────────────────────────────────────────────────────────
  // Ausgangspunkt ist immer das Objekt aus `requireWegProperty` – die Filter
  // verengen nur. Vorher zeigte die Seite die letzten 100 Buchungen und schnitt
  // danach ab: Ältere Belege waren über die Oberfläche gar nicht erreichbar.
  const q = normalizeSearch(sp.q);
  const currentPage = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "datum");

  const bookingAnd: Prisma.BookingWhereInput[] = [{ propertyId: property.id }];
  if (q) {
    bookingAnd.push({
      OR: [
        { text: { contains: q, mode: "insensitive" } },
        { counterparty: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (sp.konto) bookingAnd.push({ accountId: sp.konto });
  if (sp.art === "EINNAHME" || sp.art === "AUSGABE" || sp.art === "UMBUCHUNG") {
    bookingAnd.push({ kind: sp.art });
  }
  if (sp.kostenart) bookingAnd.push({ costTypeId: sp.kostenart });
  // „Ohne Kostenart" ist die Arbeitsliste nach jedem Bankimport: solange hier
  // etwas offen ist, lässt sich die Jahresabrechnung nicht fertigstellen.
  if (sp.zuordnung === "offen") {
    bookingAnd.push({ costTypeId: null, kind: { in: ["EINNAHME", "AUSGABE"] } });
  }
  const jahr = Number.parseInt(sp.jahr ?? "", 10);
  if (Number.isFinite(jahr) && jahr > 1900 && jahr < 2200) {
    bookingAnd.push({
      bookingDate: { gte: new Date(jahr, 0, 1), lt: new Date(jahr + 1, 0, 1) },
    });
  }
  const bookingWhere: Prisma.BookingWhereInput = { AND: bookingAnd };
  const hasFilter = Boolean(q || sp.konto || sp.art || sp.kostenart || sp.jahr || sp.zuordnung);

  const [handwerkerSummen, alleHandwerker, accounts, costTypes, sums, bookingTotal, bookings, aeltesteBuchung, batches, ohneKostenart, fertigeJahre] = await Promise.all([
    // Jahressummen je Handwerker für die Bauabzugsteuer-Warnung (§ 48 EStG).
    // Bewusst hier und nicht im Client nachgeladen: Die Warnung muss stehen,
    // bevor gebucht wird, und ein Nachladen bei jedem Tastendruck im
    // Betragsfeld wäre spürbar.
    bauleistungenJeHandwerker(property.organizationId, new Date()),
    db.craftsman.findMany({
      where: { organizationId: property.organizationId, active: true },
      orderBy: [{ company: "asc" }, { name: "asc" }],
      select: { id: true, name: true, company: true, exemptionNumber: true, exemptionValidUntil: true },
    }),
    db.ledgerAccount.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    db.costType.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      select: { id: true, name: true, laborShareType: true, constructionWork: true },
    }),
    // Kontensalden immer über ALLE Buchungen – ein Saldo, der sich mit dem
    // Filter verändert, wäre kein Saldo mehr.
    db.booking.groupBy({
      by: ["accountId", "kind", "transferOut"],
      where: { propertyId: property.id },
      _sum: { amountCents: true },
    }),
    db.booking.count({ where: bookingWhere }),
    db.booking.findMany({
      where: bookingWhere,
      include: {
        account: { select: { name: true, kind: true } },
        costType: { select: { name: true, laborShareType: true, laborSharePercent: true } },
        reversedBy: { select: { id: true } },
      },
      orderBy: [toOrderBy(sort.field, sort.dir), { createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // Ältester Beleg – daraus entsteht die Jahresauswahl.
    db.booking.findFirst({
      where: { propertyId: property.id },
      orderBy: { bookingDate: "asc" },
      select: { bookingDate: true },
    }),
    db.bankImportBatch.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { account: { select: { name: true } }, _count: { select: { bookings: true } } },
    }),
    // Arbeitsvorrat: Einnahmen/Ausgaben ohne Kostenart. Immer über ALLE
    // Buchungen gezählt – die Zahl soll unabhängig vom Filter stimmen.
    db.booking.count({
      where: {
        propertyId: property.id,
        costTypeId: null,
        kind: { in: ["EINNAHME", "AUSGABE"] },
        ...NOT_REVERSED,
      },
    }),
    // Abgeschlossene Wirtschaftsjahre – dort sind Buchungen unantastbar.
    db.annualStatement.findMany({
      where: { propertyId: property.id, status: "FERTIG" },
      select: { year: true },
    }),
  ]);
  const lockedYears = new Set(fertigeJahre.map((s) => s.year));

  // Handwerker für die Auswahl, angereichert um die Jahressumme. `…Summen`
  // enthält nur die, an die dieses Jahr schon Bauleistungen gezahlt wurden —
  // zur Auswahl stehen muss aber jeder.
  const summeJeHandwerker = new Map(handwerkerSummen.map((h) => [h.craftsmanId, h.bisherCents]));
  const handwerkerWahl = alleHandwerker.map((h) => ({
    id: h.id,
    name: h.company ? `${h.company} (${h.name})` : h.name,
    bisherCents: summeJeHandwerker.get(h.id) ?? 0,
    exemptionNumber: h.exemptionNumber,
    // Nur Daten, die durch die Server/Client-Grenze müssen — als ISO-Zeichenkette.
    exemptionValidUntil: h.exemptionValidUntil?.toISOString() ?? null,
  }));

  const giro = accounts.filter((a) => a.kind === "GIRO");
  const ruecklage = accounts.filter((a) => a.kind === "RUECKLAGE");

  const totalPages = Math.max(1, Math.ceil(bookingTotal / PAGE_SIZE));

  // Jahre vom ältesten Beleg bis heute – die Wirtschaftsjahre, die es gibt.
  const jetzt = new Date().getFullYear();
  const erstesJahr = aeltesteBuchung?.bookingDate.getFullYear() ?? jetzt;
  const jahre = Array.from({ length: Math.max(1, jetzt - erstesJahr + 1) }, (_, i) => jetzt - i);

  const bookingFilters: FilterConfig[] = [
    {
      key: "jahr",
      label: "Jahr",
      primary: true,
      options: jahre.map((j) => ({ value: String(j), label: String(j) })),
    },
    {
      key: "konto",
      label: "Konto",
      primary: true,
      options: accounts.map((a) => ({ value: a.id, label: a.name })),
    },
    {
      key: "art",
      label: "Art",
      options: (Object.keys(bookingKindLabels) as Array<keyof typeof bookingKindLabels>).map(
        (k) => ({ value: k, label: bookingKindLabels[k] }),
      ),
    },
    {
      key: "kostenart",
      label: "Kostenart",
      options: costTypes.map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: "zuordnung",
      label: "Zuordnung",
      primary: ohneKostenart > 0,
      options: [{ value: "offen", label: "Ohne Kostenart" }],
    },
  ];

  const pageHref = pageHrefFor(`/verwaltung/weg/${property.id}/buchhaltung`, sp);

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className={buttonSecondaryClass}>
              Stammdaten
            </Link>
          </div>
        }
      >
        Buchhaltung · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {sp.gespeichert === "umbuchung"
            ? "Umbuchung erfasst."
            : sp.gespeichert === "lohnanteil"
              ? "Lohnanteil gespeichert."
              : "Buchung erfasst."}
        </Alert>
      ) : null}
      {sp.import !== undefined ? (
        <Alert variant="success" className="mb-4">
          Import abgeschlossen: {sp.import} Buchung(en) übernommen
          {sp.uebersprungen && sp.uebersprungen !== "0"
            ? `, ${sp.uebersprungen} Zeile(n) übersprungen (Duplikate/nicht lesbar)`
            : ""}
          .
        </Alert>
      ) : null}
      {sp.zugeordnet ? (
        <Alert variant="success" className="mb-4">
          {sp.zugeordnet} {sp.zugeordnet === "1" ? "Buchung" : "Buchungen"} zugeordnet.
        </Alert>
      ) : null}
      {sp.storniert ? (
        <Alert variant="success" className="mb-4">
          Buchung storniert. Original und Gegenbuchung bleiben im Journal stehen — der
          Kontostand ist wieder wie vorher.
        </Alert>
      ) : null}
      {sp.importzurueck ? (
        <Alert variant="success" className="mb-4">
          Import zurückgenommen: {sp.importzurueck}{" "}
          {sp.importzurueck === "1" ? "Buchung" : "Buchungen"} entfernt.
        </Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER_TEXTE[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      {/* Arbeitsvorrat: ohne Kostenart keine Umlage – und keine Jahresabrechnung. */}
      {ohneKostenart > 0 && sp.zuordnung !== "offen" ? (
        <Alert variant="warning" title="Buchungen ohne Kostenart" className="mb-4">
          {ohneKostenart} {ohneKostenart === 1 ? "Buchung ist" : "Buchungen sind"} keiner
          Kostenart zugeordnet und {ohneKostenart === 1 ? "kann" : "können"} deshalb nicht auf
          die Einheiten umgelegt werden. Solange das offen ist, lässt sich die
          Jahresabrechnung nicht fertigstellen.{" "}
          <Link href={`/verwaltung/weg/${property.id}/buchhaltung?zuordnung=offen`} className="underline">
            Jetzt zuordnen
          </Link>
          .
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {/* Kontenübersicht — Rücklage strikt getrennt ausgewiesen */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Laufende Konten (Giro)">
            {giro.length === 0 ? (
              <EmptyState>
                Kein Girokonto angelegt —{" "}
                <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className="underline">
                  jetzt in den Stammdaten anlegen
                </Link>
                .
              </EmptyState>
            ) : (
              <dl className="grid gap-3">
                {giro.map((a) => (
                  <div key={a.id} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-gray-600">
                      {a.name}
                      {a.iban ? <span className="block text-xs text-gray-400">{a.iban}</span> : null}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCents(balanceFor(a, sums))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
          <Card title="Erhaltungsrücklage (getrennt)">
            {ruecklage.length === 0 ? (
              <EmptyState>
                Kein Rücklagenkonto angelegt — die Erhaltungsrücklage muss getrennt vom
                laufenden Konto geführt werden.
              </EmptyState>
            ) : (
              <dl className="grid gap-3">
                {ruecklage.map((a) => (
                  <div key={a.id} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-gray-600">
                      {a.name}
                      {a.iban ? <span className="block text-xs text-gray-400">{a.iban}</span> : null}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCents(balanceFor(a, sums))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        </div>

        {/* Manuelle Buchung */}
        <Card title="Buchung erfassen">
          {accounts.length === 0 ? (
            <EmptyState>Zuerst in den Stammdaten ein Konto anlegen.</EmptyState>
          ) : (
            <form action={createBooking} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Konto">
                <select name="accountId" className={`${inputClass} w-auto`} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({ledgerAccountKindLabels[a.kind]})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Art">
                <select name="kind" className={`${inputClass} w-auto`} defaultValue="AUSGABE">
                  <option value="EINNAHME">Einnahme</option>
                  <option value="AUSGABE">Ausgabe</option>
                </select>
              </Field>
              <DateField
                label="Buchungstag"
                name="bookingDate"
                required
                className="w-auto"
              />
              <Field label="Betrag (€)">
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${inputClass} w-28`}
                  required
                />
              </Field>
              <Field label="Kostenart">
                <select name="costTypeId" className={`${inputClass} w-auto`} defaultValue="">
                  <option value="">— keine —</option>
                  {costTypes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {/* §35a: nur der Lohn-, Fahrt- und Maschinenkostenanteil ist
                  begünstigt. Er steht auf der Rechnung; leer lassen ist besser
                  als raten — die Abrechnung weist die Lücke dann aus. */}
              <Field label="davon Lohnanteil § 35a (€, optional)">
                <input
                  name="laborShare"
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${inputClass} w-28`}
                />
              </Field>
              <Field label="Buchungstext">
                <input
                  name="text"
                  className={`${inputClass} w-64`}
                  placeholder="z. B. Rechnung Hausmeister März"
                  required
                  minLength={2}
                />
              </Field>
              <Field label="Zahlungspartner (optional)">
                <input name="counterparty" className={`${inputClass} w-48`} />
              </Field>
              {/* Der Handwerker als Verknüpfung — Grundlage der Prüfung nach
                  § 48 EStG. Über den Freitext daneben ließe sich nicht
                  summieren, und die 5.000-€-Grenze gilt je Leistendem. */}
              <BauabzugHinweis
                handwerker={handwerkerWahl}
                bauleistungKostenarten={costTypes.filter((c) => c.constructionWork).map((c) => c.id)}
                inputClass={inputClass}
              />
              <Field label="Beleg (Foto/PDF, optional)">
                <FileInput
                  name="beleg"
                  accept="image/*,application/pdf"
                />
              </Field>
              <PendingButton className={buttonClass}>Buchen</PendingButton>
            </form>
          )}
        </Card>

        {/* Umbuchung */}
        {accounts.length >= 2 ? (
          <Card title="Umbuchung (z. B. Zuführung zur Erhaltungsrücklage)">
            <form action={createTransfer} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <Field label="Von Konto">
                <select name="fromAccountId" className={`${inputClass} w-auto`} required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Auf Konto">
                <select
                  name="toAccountId"
                  className={`${inputClass} w-auto`}
                  required
                  defaultValue={ruecklage[0]?.id ?? accounts[1]?.id}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <DateField
                label="Datum"
                name="bookingDate"
                required
                className="w-auto"
              />
              <Field label="Betrag (€)">
                <input
                  name="amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${inputClass} w-28`}
                  required
                />
              </Field>
              <Field label="Text">
                <input
                  name="text"
                  className={`${inputClass} w-64`}
                  defaultValue="Zuführung Erhaltungsrücklage"
                  required
                  minLength={2}
                />
              </Field>
              <PendingButton className={buttonClass}>Umbuchen</PendingButton>
            </form>
          </Card>
        ) : null}

        {/* CSV-Import */}
        <Card title="Bankumsätze importieren (CSV — ohne Bankanbindung)">
          {accounts.length === 0 ? (
            <EmptyState>Zuerst in den Stammdaten ein Konto anlegen.</EmptyState>
          ) : (
            <>
              <ImportClient
                propertyId={property.id}
                accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
              />
              {batches.length > 0 ? (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Letzte Importe
                  </p>
                  <ul className="grid gap-1.5">
                    {batches.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500"
                      >
                        <span>
                          {formatDateOnly(b.createdAt)} · {b.fileName} → {b.account.name} (
                          {b.rowsImported} importiert, {b.rowsSkipped} übersprungen)
                        </span>
                        {b._count.bookings > 0 ? (
                          <form action={undoImportBatch}>
                            <input type="hidden" name="propertyId" value={property.id} />
                            <input type="hidden" name="batchId" value={b.id} />
                            <ConfirmActionButton
                              className="text-xs text-red-600 hover:underline"
                              confirmLabel={`${b._count.bookings} ${b._count.bookings === 1 ? "Buchung" : "Buchungen"} entfernen?`}
                              pendingLabel="Wird zurückgenommen…"
                            >
                              Import zurücknehmen
                            </ConfirmActionButton>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <Tipp className="mt-2">
                    Ein falsch zugeordneter Import lässt sich im Ganzen zurücknehmen, solange
                    keine Buchung daraus storniert wurde und das Wirtschaftsjahr noch offen ist.
                  </Tipp>
                </div>
              ) : null}
            </>
          )}
        </Card>

        {/* Buchungsliste */}
        <Card title="Buchungen">
          <FilterBar
            searchPlaceholder="Suchen"
            searchHint="In Buchungstext und Empfänger/Zahler suchen"
            filters={bookingFilters}
          />
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-gray-400">
              {bookingTotal} {bookingTotal === 1 ? "Buchung" : "Buchungen"}
              {hasFilter ? " (gefiltert)" : ""}
            </p>
            <SortControl sortOptions={SORT_OPTIONS} defaultSort="datum" />
          </div>
          {bookings.length === 0 ? (
            <EmptyState>
              {hasFilter ? "Keine Buchungen gefunden." : "Noch keine Buchungen."}
            </EmptyState>
          ) : (
            <>
            {costTypes.length > 0 ? (
              <form
                id="kostenart-zuordnen"
                action={assignCostType}
                className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3"
              >
                <input type="hidden" name="propertyId" value={property.id} />
                <Field label="Ausgewählte Buchungen zuordnen">
                  <select name="costTypeId" className={`${inputClass} w-auto`} defaultValue="">
                    <option value="">— Zuordnung aufheben —</option>
                    {costTypes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {/* Handwerker gleich mit zuordnen. Für importierte Buchungen ist
                    das der einzige Weg zur Prüfung nach § 48 EStG: Die Bank
                    liefert nur Text, und über Text lässt sich nicht summieren. */}
                <Field label="Handwerker (optional)">
                  <select name="craftsmanId" className={`${inputClass} w-auto`} defaultValue="">
                    <option value="">— unverändert lassen —</option>
                    <option value="OHNE">— Zuordnung aufheben —</option>
                    {handwerkerWahl.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <PendingButton className={buttonSecondaryClass}>Zuordnen</PendingButton>
                <Tipp className="w-full">
                  Erst in der Liste auswählen, dann Kostenart wählen und setzen. Umbuchungen
                  tragen keine Kostenart — sie sind kein Aufwand, sondern verschieben Geld
                  zwischen den Konten der Gemeinschaft.
                </Tipp>
              </form>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-2">
                      <span className="sr-only">Auswahl</span>
                    </th>
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Konto</th>
                    <th className="py-2 pr-3">Art</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Kostenart</th>
                    <th className="py-2 pr-3">Lohnanteil § 35a</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2 pr-3">Beleg</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const sign =
                      b.kind === "EINNAHME" ? 1 : b.kind === "AUSGABE" ? -1 : b.transferOut ? -1 : 1;
                    // Stornopaare bleiben sichtbar, sind aber nicht mehr änderbar;
                    // dasselbe gilt für abgeschlossene Wirtschaftsjahre.
                    const istStorno = b.reversalOfId !== null;
                    const storniert = b.reversedBy !== null;
                    const gesperrt =
                      istStorno ||
                      storniert ||
                      isDateLocked(b.bookingDate, lockedYears, property.fiscalYearStartMonth);
                    const kostenartMoeglich = b.kind !== "UMBUCHUNG" && !gesperrt;
                    // Der Lohnanteil ist nur bei Ausgaben einer §35a-Kostenart
                    // eine Frage. Bei allen anderen bleibt die Spalte leer,
                    // statt zu einer Angabe einzuladen, die nichts bewirkt.
                    const lohnanteilMoeglich =
                      b.kind === "AUSGABE" &&
                      !gesperrt &&
                      b.costType != null &&
                      b.costType.laborShareType !== "KEINE";
                    return (
                      <tr
                        key={b.id}
                        className={`border-b border-gray-100 ${istStorno || storniert ? "text-gray-400" : ""}`}
                      >
                        <td className="py-2 pr-2 align-top">
                          {kostenartMoeglich ? (
                            <input
                              type="checkbox"
                              form="kostenart-zuordnen"
                              name="bookingId"
                              value={b.id}
                              aria-label={`Buchung ${b.text} auswählen`}
                              className="mt-1 h-4 w-4 cursor-pointer accent-gray-900"
                            />
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-gray-600">
                          {formatDateOnly(b.bookingDate)}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{b.account.name}</td>
                        <td className="py-2 pr-3 text-gray-600">{bookingKindLabels[b.kind]}</td>
                        <td className="py-2 pr-3 text-gray-900">
                          {b.text}
                          {b.counterparty ? (
                            <span className="block text-xs text-gray-400">{b.counterparty}</span>
                          ) : null}
                          {storniert ? (
                            <span className="block text-xs font-medium text-red-600">storniert</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {b.costType?.name ?? (
                            <span className={b.kind === "UMBUCHUNG" ? "text-gray-300" : "text-amber-600"}>
                              {b.kind === "UMBUCHUNG" ? "—" : "fehlt"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {lohnanteilMoeglich ? (
                            <form action={setLaborShare} className="flex items-center gap-1">
                              <input type="hidden" name="propertyId" value={property.id} />
                              <input type="hidden" name="bookingId" value={b.id} />
                              <input
                                name="laborShare"
                                inputMode="decimal"
                                defaultValue={
                                  b.laborShareCents == null ? "" : formatCents(b.laborShareCents)
                                }
                                placeholder={
                                  b.costType?.laborSharePercent == null
                                    ? "nicht erfasst"
                                    : `${b.costType.laborSharePercent} % geschätzt`
                                }
                                aria-label={`Lohnanteil für ${b.text}`}
                                className={`${inputClass} w-32`}
                              />
                              <PendingButton className="text-xs text-gray-500 underline">
                                ok
                              </PendingButton>
                            </form>
                          ) : b.laborShareCents != null ? (
                            formatCents(b.laborShareCents)
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                            sign < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {sign < 0 ? "−" : "+"}
                          {formatCents(b.amountCents)}
                        </td>
                        <td className="py-2 pr-3">
                          {b.belegStoredName ? (
                            <FilePreviewLink
                              src={`/api/files/beleg/${b.id}`}
                              title={`Beleg — ${b.text}`}
                              className="text-sm underline"
                            >
                              Beleg
                            </FilePreviewLink>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          {gesperrt ? null : (
                            <form action={reverseBooking}>
                              <input type="hidden" name="propertyId" value={property.id} />
                              <input type="hidden" name="bookingId" value={b.id} />
                              <ConfirmActionButton
                                className="text-xs text-red-600 hover:underline"
                                confirmLabel="Wirklich stornieren?"
                                pendingLabel="Wird storniert…"
                              >
                                Stornieren
                              </ConfirmActionButton>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={bookingTotal}
            itemLabel="Buchungen"
            hrefFor={pageHref}
          />
        </Card>
      </div>
    </>
  );
}
