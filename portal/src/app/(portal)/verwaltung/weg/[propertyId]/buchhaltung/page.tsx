import Link from "next/link";
import {
  BackButton,
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,} from "@/components/ui";
import { db } from "@/lib/db";
import { bookingKindLabels, formatDateOnly, ledgerAccountKindLabels } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { createBooking, createTransfer } from "./actions";
import { ImportClient } from "./ImportClient";

export const dynamic = "force-dynamic";

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
  beleg: "Der Beleg konnte nicht gespeichert werden (erlaubt: Foto oder PDF).",
  gleicheskonto: "Quell- und Zielkonto müssen unterschiedlich sein.",
  mapping: "Bitte die Spalten für Datum, Betrag und Verwendungszweck zuordnen.",
  keinezeilen: "Die Datei enthält keine importierbaren Umsätze.",
  datei: "Die Datei konnte nicht verarbeitet werden.",
};

export default async function WegBuchhaltungPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string; import?: string; uebersprungen?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const [accounts, costTypes, sums, bookings, batches] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    db.costType.findMany({
      where: { propertyId: property.id, active: true },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.booking.groupBy({
      by: ["accountId", "kind", "transferOut"],
      where: { propertyId: property.id },
      _sum: { amountCents: true },
    }),
    db.booking.findMany({
      where: { propertyId: property.id },
      include: {
        account: { select: { name: true, kind: true } },
        costType: { select: { name: true } },
      },
      orderBy: [{ bookingDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.bankImportBatch.findMany({
      where: { propertyId: property.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { account: { select: { name: true } } },
    }),
  ]);

  const giro = accounts.filter((a) => a.kind === "GIRO");
  const ruecklage = accounts.filter((a) => a.kind === "RUECKLAGE");

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className={buttonSecondaryClass}>
              Stammdaten
            </Link>
            <BackButton href="/verwaltung/weg">WEG-Finanzen</BackButton>
          </div>
        }
      >
        Buchhaltung · {property.name}
      </PageTitle>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {sp.gespeichert === "umbuchung" ? "Umbuchung erfasst." : "Buchung erfasst."}
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
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER_TEXTE[sp.fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
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
              <Field label="Buchungstag">
                <input name="bookingDate" type="date" className={`${inputClass} w-auto`} required />
              </Field>
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
              <Field label="Beleg (Foto/PDF, optional)">
                <input
                  type="file"
                  name="beleg"
                  accept="image/*,application/pdf"
                  className={inputClass}
                />
              </Field>
              <button type="submit" className={buttonClass}>
                Buchen
              </button>
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
              <Field label="Datum">
                <input name="bookingDate" type="date" className={`${inputClass} w-auto`} required />
              </Field>
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
              <button type="submit" className={buttonClass}>
                Umbuchen
              </button>
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
                <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
                  Letzte Importe:{" "}
                  {batches
                    .map(
                      (b) =>
                        `${b.fileName} → ${b.account.name} (${b.rowsImported} importiert, ${b.rowsSkipped} übersprungen)`,
                    )
                    .join(" · ")}
                </div>
              ) : null}
            </>
          )}
        </Card>

        {/* Buchungsliste */}
        <Card title={`Buchungen (letzte ${bookings.length})`}>
          {bookings.length === 0 ? (
            <EmptyState>Noch keine Buchungen.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Konto</th>
                    <th className="py-2 pr-3">Art</th>
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Kostenart</th>
                    <th className="py-2 pr-3 text-right">Betrag</th>
                    <th className="py-2">Beleg</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const sign =
                      b.kind === "EINNAHME" ? 1 : b.kind === "AUSGABE" ? -1 : b.transferOut ? -1 : 1;
                    return (
                      <tr key={b.id} className="border-b border-gray-100">
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
                        </td>
                        <td className="py-2 pr-3 text-gray-600">{b.costType?.name ?? "—"}</td>
                        <td
                          className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${
                            sign < 0 ? "text-red-700" : "text-green-700"
                          }`}
                        >
                          {sign < 0 ? "−" : "+"}
                          {formatCents(b.amountCents)}
                        </td>
                        <td className="py-2">
                          {b.belegStoredName ? (
                            <a
                              href={`/api/files/beleg/${b.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm underline"
                            >
                              Beleg
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
        </Card>
      </div>
    </>
  );
}
