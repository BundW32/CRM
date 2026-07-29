import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type Column } from "@/components/data-display";
import { DateField } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { Tipp } from "@/components/tipp";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { VERZUGSAUFSCHLAG_PUNKTE } from "@/lib/weg/verzug";
import { addBaseRate, deleteBaseRate } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER_TEXTE: Record<string, string> = {
  eingabe: "Bitte Geltungsbeginn und Zinssatz ausfüllen.",
  datum: "Das Datum konnte nicht gelesen werden.",
  satz: "Der Zinssatz konnte nicht gelesen werden. Erwartet wird eine Prozentangabe wie 3,62 oder -0,88.",
  doppelt:
    "Für diesen Geltungsbeginn ist bereits ein Satz hinterlegt. Löschen Sie ihn zuerst, wenn Sie ihn korrigieren wollen.",
  nichtgefunden: "Der Eintrag wurde nicht gefunden.",
};

type Zeile = { id: string; validFrom: Date; basisPoints: number };

export default async function BasiszinssatzPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler } = await searchParams;

  const saetze = await db.baseInterestRate.findMany({
    where: { organizationId: verwalter.organizationId },
    orderBy: { validFrom: "desc" },
    select: { id: true, validFrom: true, basisPoints: true },
  });

  const spalten: Column<Zeile>[] = [
    { header: "Gilt ab", cell: (z) => formatDateOnly(z.validFrom) },
    {
      header: "Basiszinssatz",
      align: "right",
      cell: (z) => `${(z.basisPoints / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} %`,
    },
    {
      header: `Verzugszinssatz (+ ${VERZUGSAUFSCHLAG_PUNKTE} Punkte)`,
      align: "right",
      cell: (z) => (
        <strong>
          {(z.basisPoints / 100 + VERZUGSAUFSCHLAG_PUNKTE).toLocaleString("de-DE", {
            minimumFractionDigits: 2,
          })}{" "}
          %
        </strong>
      ),
    },
    {
      cell: (z) => (
        <form action={deleteBaseRate}>
          <input type="hidden" name="id" value={z.id} />
          <ConfirmDeleteButton title="Satz löschen" />
        </form>
      ),
      className: "w-px",
    },
  ];

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}>
        Basiszinssatz
      </PageTitle>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER_TEXTE[fehler] ?? "Die Eingabe konnte nicht gespeichert werden."}
        </Alert>
      ) : null}

      <Card title="Hinterlegte Sätze">
        <Tipp className="mb-3">
          Wer sein Hausgeld zu spät zahlt, schuldet der Gemeinschaft Verzugszinsen — sonst
          tragen die übrigen Eigentümer die Lücke. Der gesetzliche Zinssatz liegt{" "}
          {VERZUGSAUFSCHLAG_PUNKTE} Prozentpunkte über dem <strong>Basiszinssatz</strong>, und
          den gibt die Deutsche Bundesbank zweimal im Jahr neu bekannt — zum 1. Januar und zum
          1. Juli (§ 247 BGB).
        </Tipp>

        {/* Der entscheidende Satz auf dieser Seite. Ein Programm, das mit einem
            veralteten Zinssatz weiterrechnet, schreibt die falsche Zahl in eine
            Mahnung, die nach außen geht — und niemand merkt es. Deshalb wird
            hier gepflegt statt geraten, und deshalb steht es so deutlich da. */}
        <p className="mb-4 text-sm text-gray-600">
          Solange für einen Zeitraum kein Satz hinterlegt ist, weist das Programm dort{" "}
          <strong>keine Verzugszinsen aus</strong> und sagt Ihnen, welches Halbjahr fehlt. Das
          ist Absicht: Lieber keine Zahl als eine falsche in einem Schreiben, das der Empfänger
          nachrechnen kann.
        </p>

        <DataTable
          columns={spalten}
          rows={saetze}
          getKey={(z) => z.id}
          caption="Hinterlegte Basiszinssätze"
          empty={
            <EmptyState>
              Noch kein Satz hinterlegt — Verzugszinsen werden deshalb nirgends ausgewiesen.
              Den aktuellen Basiszinssatz finden Sie bei der Deutschen Bundesbank.
            </EmptyState>
          }
        />
      </Card>

      <div className="mt-6">
        <Card title="Satz nachtragen">
        <form action={addBaseRate} className="flex flex-wrap items-end gap-3">
          <DateField label="Gilt ab" name="validFrom" required className="w-auto" />
          <Field label="Basiszinssatz in Prozent">
            <input
              name="prozent"
              inputMode="decimal"
              placeholder="z. B. 3,62"
              className={`${inputClass} w-32`}
              required
            />
          </Field>
          <PendingButton className={buttonClass}>Eintragen</PendingButton>
        </form>
          <p className="mt-3 text-xs text-gray-500">
            Negative Werte sind zulässig — der Basiszinssatz lag jahrelang unter null.
          </p>
        </Card>
      </div>
    </>
  );
}
