import { Badge, DataTable, KeyFigure, KeyFigures, type Column } from "@/components/data-display";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Tipp } from "@/components/tipp";
import { Alert, Card, EmptyState, PageTitle } from "@/components/ui";
import { formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { EINBEHALT_PROZENT } from "@/lib/weg/bauabzugsteuer";
import { offeneAnmeldungen, type AnmeldeMonat } from "@/lib/weg/anmeldefrist-service";
import { monatAngemeldet } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  monat: "Der Monat konnte nicht gelesen werden.",
  leer: "Für diesen Monat steht keine Anmeldung mehr offen — vermutlich wurde sie bereits vermerkt.",
};

export default async function BauabzugsteuerPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const sp = await searchParams;

  const monate = await offeneAnmeldungen(verwalter.organizationId);
  const summeCents = monate.reduce((s, m) => s + m.summeCents, 0);
  const ueberfaellig = monate.filter((m) => m.lage === "UEBERFAELLIG");

  const spalten: Column<AnmeldeMonat["buchungen"][number]>[] = [
    { header: "Gezahlt am", cell: (b) => formatDateOnly(b.bookingDate) },
    {
      header: "Vorgang",
      cell: (b) => (
        <div>
          <div className="text-gray-900">{b.text}</div>
          <div className="text-xs text-gray-500">
            {b.propertyName}
            {b.craftsmanName ? ` · ${b.craftsmanName}` : ""}
          </div>
        </div>
      ),
    },
    { header: "Rechnung", align: "right", cell: (b) => formatCents(b.amountCents) },
    {
      header: `Einbehalt (${EINBEHALT_PROZENT} %)`,
      align: "right",
      cell: (b) => <span className="font-medium">{formatCents(b.bauabzugCents)}</span>,
    },
  ];

  return (
    <>
      <PageTitle>Bauabzugsteuer — Anmeldungen</PageTitle>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Die Eingabe konnte nicht verarbeitet werden."}
        </Alert>
      ) : null}

      <KeyFigures>
        <KeyFigure
          label="Noch anzumelden"
          value={formatCents(summeCents)}
          tone={summeCents > 0 ? "warn" : "neutral"}
          hint="einbehalten, aber noch nicht ans Finanzamt gemeldet"
        />
        <KeyFigure label="Offene Monate" value={String(monate.length)} />
        <KeyFigure
          label="Frist versäumt"
          value={String(ueberfaellig.length)}
          tone={ueberfaellig.length > 0 ? "critical" : "neutral"}
        />
      </KeyFigures>

      <div className="mt-6 space-y-4">
        {monate.length === 0 ? (
          <Card title="Keine offenen Anmeldungen">
            <EmptyState>
              Es wurde nichts einbehalten, was noch anzumelden wäre. Das ist der Normalfall:
              Legt der Handwerker eine gültige Freistellungsbescheinigung vor oder bleibt die
              Summe unter 5.000 € im Jahr, entfällt der Einbehalt — und damit auch die
              Anmeldung.
            </EmptyState>
          </Card>
        ) : (
          monate.map((m) => (
            <Card
              key={m.monat}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span>Zahlungen im {m.bezeichnung}</span>
                  {m.lage === "UEBERFAELLIG" ? (
                    <Badge tone="danger">Frist war der {formatDateOnly(m.frist)}</Badge>
                  ) : m.lage === "BALD" ? (
                    <Badge tone="warning">bis {formatDateOnly(m.frist)}</Badge>
                  ) : (
                    <Badge tone="neutral">bis {formatDateOnly(m.frist)}</Badge>
                  )}
                </span>
              }
            >
              <DataTable
                columns={spalten}
                rows={m.buchungen}
                getKey={(b) => b.id}
                minWidth="44rem"
                caption={`Einbehalte im ${m.bezeichnung}`}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div className="text-sm">
                  <span className="text-gray-500">Anzumelden und abzuführen: </span>
                  <span className="text-base font-semibold text-gray-900">
                    {formatCents(m.summeCents)}
                  </span>
                </div>
                <form action={monatAngemeldet}>
                  <input type="hidden" name="monat" value={m.monat} />
                  <ConfirmActionButton
                    className="text-sm font-medium text-brand-green hover:underline"
                    confirmLabel="Wirklich als angemeldet vermerken?"
                    pendingLabel="Wird vermerkt…"
                  >
                    Als angemeldet vermerken
                  </ConfirmActionButton>
                </form>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6">
        <Card title="Was hier passiert">
          <Tipp>
            Wenn Sie eine Handwerkerrechnung für eine <strong>Bauleistung</strong> bezahlen
            und der Betrieb keine gültige Freistellungsbescheinigung vorgelegt hat, müssen
            Sie {EINBEHALT_PROZENT} % einbehalten (§ 48 EStG). Damit ist es aber nicht getan:
            Der einbehaltene Betrag muss bis zum <strong>10. Tag des Folgemonats</strong> beim
            Finanzamt des Handwerkers angemeldet und überwiesen werden (§ 48a Abs. 1 EStG).
            Fällt der 10. auf ein Wochenende oder einen Feiertag, verschiebt sich die Frist auf
            den nächsten Werktag (§ 108 Abs. 3 AO) — diese Seite rechnet das mit.
          </Tipp>
          <Tipp className="mt-3">
            <strong>Das Programm meldet nichts selbst an.</strong> Es weiß, dass Sie
            einbehalten haben, und erinnert Sie an die Frist. Die Anmeldung geben Sie beim
            Finanzamt des Handwerkers ab (Vordruck &bdquo;Anmeldung über den Steuerabzug bei
            Bauleistungen&ldquo;), überweisen den Betrag und haken den Monat hier ab. Der Haken ist
            ein Vermerk, keine Abgabe.
          </Tipp>
          <Tipp className="mt-3">
            Der einfachste Weg, das ganze Thema loszuwerden: die
            Freistellungsbescheinigung nach § 48b EStG beim Handwerker anfordern und in
            seinem Kontakt hinterlegen. Die meisten Betriebe haben eine. Dann entfällt der
            Einbehalt — und diese Seite bleibt leer.
          </Tipp>
        </Card>
      </div>
    </>
  );
}
