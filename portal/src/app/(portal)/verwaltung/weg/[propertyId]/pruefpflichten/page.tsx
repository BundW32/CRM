import Link from "next/link";
import type { MaintenanceTask } from "@/generated/prisma/client";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import {
  Alert,
  Card,
  CollapsibleCard,
  EmptyState,
  Field,
  PageTitle,
  buttonCompact,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { db } from "@/lib/db";
import { formatDateOnly, maintenanceIntervalLabels } from "@/lib/labels";
import { isMailEnabled } from "@/lib/mailer";
import { classifyDue, dueLabel } from "@/lib/weg/compliance";
import { WEG_COMPLIANCE_CATALOG } from "@/lib/weg/compliance-catalog";
import { requireWegProperty } from "@/lib/weg/scope";
import { DateField, SelectField, toDateInputValue } from "@/components/fields";
import { Tipp } from "@/components/tipp";
import {
  adoptComplianceCatalog,
  completeCompliance,
  createCompliance,
  deleteCompliance,
  setComplianceActive,
  updateCompliance,
} from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  datum: "Das Fälligkeitsdatum konnte nicht gelesen werden.",
  titel: "Bitte einen Titel mit mindestens zwei Zeichen angeben.",
  turnus: "Der Turnus konnte nicht gelesen werden.",
  // „Eintrag" statt „Prüfpflicht": Auf dieser Seite stehen inzwischen auch die
  // eigenen Termine der Gemeinschaft, und die sind keine Prüfpflicht.
  nichtgefunden: "Der Eintrag wurde nicht gefunden.",
};
const OK: Record<string, string> = {
  katalog: "Prüfpflichten-Katalog übernommen.",
  erstellt: "Eigene Prüfpflicht angelegt.",
  gespeichert: "Änderungen gespeichert.",
  erledigt: "Als erledigt markiert — nächste Fälligkeit gesetzt.",
  ausgeblendet:
    "Ausgeblendet: trifft auf dieses Objekt nicht zu. Unter „Nicht im Fahrplan“ wieder aufnehmbar.",
  aufgenommen: "Wieder in den Fahrplan aufgenommen.",
  geloescht: "Gelöscht.",
};

// Auswahl für das Turnus-Feld. Einzige Quelle ist der Beschriftungs-Katalog —
// kommt ein Intervall hinzu, steht es hier ohne Zutun.
const TURNUS_OPTIONEN = Object.entries(maintenanceIntervalLabels).map(
  ([value, label]) => ({ value, label }),
);

export default async function PruefpflichtenPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const tasks = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, catalogKey: { not: null }, active: true },
    orderBy: { dueDate: "asc" },
  });
  // Eigene Prüfpflichten und Termine der Gemeinschaft: dasselbe Modell, nur ohne
  // `catalogKey`. Angelegt werden sie unten auf dieser Seite oder über den
  // Jahresfahrplan auf der Übersicht.
  const eigene = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, catalogKey: null, active: true },
    orderBy: { dueDate: "asc" },
  });
  // Ausgeblendete Einträge: „trifft auf dieses Objekt nicht zu" — und die
  // abgeschlossenen einmaligen Termine, die dieselbe Kennzeichnung tragen.
  const inaktiv = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, active: false },
    orderBy: { dueDate: "asc" },
  });

  const adoptedKeys = new Set(
    [...tasks, ...inaktiv].filter((t) => t.catalogKey).map((t) => t.catalogKey),
  );
  const notYetAdopted = WEG_COMPLIANCE_CATALOG.filter((d) => !adoptedKeys.has(d.key));
  const now = new Date();
  const today = toDateInputValue(now)!;

  return (
    <>
      <PageTitle
        back={{ href: `/verwaltung/weg/${property.id}`, label: property.name }}
      >
        Prüfpflichten – {property.name}
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Wiederkehrende Prüf- und Verwaltungspflichten Ihrer Gemeinschaft mit
        Fälligkeit. Fällige und überfällige Pflichten erscheinen zusätzlich im
        Dashboard. Die Turnusse des Katalogs (TrinkwV, BetrSichV, GEG,
        DIN&nbsp;14676, WEG) sind Richtwerte; maßgeblich sind Gemeinschaftsordnung,
        Herstellervorgabe und Gefährdungsbeurteilung — passen Sie Turnus und
        Fälligkeit an Ihre konkrete Anlage an.
      </p>

      {sp.fehler ? (
        <Alert variant="error" className="mb-4">
          {FEHLER[sp.fehler] ?? "Eingabe konnte nicht verarbeitet werden."}
        </Alert>
      ) : null}
      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">
          {OK[sp.gespeichert] ?? "Gespeichert."}
        </Alert>
      ) : null}

      {!isMailEnabled() ? (
        <Alert variant="info" className="mb-4">
          E-Mail-Erinnerungen sind nicht eingerichtet (kein SMTP hinterlegt) —
          fällige Prüfpflichten werden ausschließlich im Dashboard angezeigt.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {tasks.length === 0 ? (
            <EmptyState>
              Für dieses Objekt sind noch keine Prüfpflichten übernommen.
            </EmptyState>
          ) : (
            tasks.map((t) => (
              <TerminKarte key={t.id} t={t} propertyId={property.id} now={now} />
            ))
          )}

          {eigene.length > 0 ? (
            <div className="pt-2">
              <h2 className="mb-2 text-sm font-semibold text-gray-200">
                Eigene Prüfpflichten und Termine
              </h2>
              <Tipp className="mb-3 max-w-3xl">
                Alles, was der Standardkatalog nicht kennt — vom Tiefgaragentor bis
                zum Wartungsvertrag mit abweichendem Turnus. Angelegt hier unten oder
                über den Jahresfahrplan auf der Übersicht; sie stehen im selben
                Fahrplan wie die Prüfpflichten.
              </Tipp>
              <div className="space-y-3">
                {eigene.map((t) => (
                  <TerminKarte key={t.id} t={t} propertyId={property.id} now={now} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Anlegen gehört nicht neben die Liste (AGENTS.md): vier Felder sind
              ein kurzes Formular, also eine `CollapsibleCard` UNTER der Liste
              statt einer eigenen Route. */}
          <div className="pt-2">
            <CollapsibleCard title="Eigene Prüfpflicht anlegen" id="eigene-pflicht">
              <p className="mb-4 text-sm text-gray-600">
                Für Pflichten und Termine, die der Standardkatalog nicht abdeckt.
                Sie werden wie eine übernommene Pflicht behandelt: Fälligkeit im
                Fahrplan, Vorwarnung im Dashboard, „Erledigt“ rechnet den nächsten
                Termin im Turnus aus.
              </p>
              <form action={createCompliance} className="space-y-3">
                <input type="hidden" name="propertyId" value={property.id} />
                <Field label="Titel">
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={200}
                    placeholder="z. B. Wartung Tiefgaragentor"
                    className={inputClass}
                  />
                </Field>
                <Field label="Beschreibung (optional)">
                  <textarea
                    name="description"
                    rows={2}
                    maxLength={2000}
                    placeholder="z. B. Rechtsgrundlage, Anlage, Vertragspartner"
                    className={inputClass}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Turnus"
                    name="interval"
                    options={TURNUS_OPTIONEN}
                    defaultValue="JAEHRLICH"
                    required
                  />
                  <DateField
                    label="Erste Fälligkeit"
                    name="dueDate"
                    defaultValue={today}
                    required
                  />
                </div>
                <SubmitButton pendingLabel="Wird angelegt…">Anlegen</SubmitButton>
              </form>
            </CollapsibleCard>
          </div>

          {inaktiv.length > 0 ? (
            <div className="pt-2" id="nicht-zutreffend">
              <h2 className="mb-2 text-sm font-semibold text-gray-200">
                Nicht im Fahrplan
              </h2>
              <Tipp className="mb-3 max-w-3xl">
                Ausgeblendete Pflichten („trifft auf dieses Objekt nicht zu“) und
                abgeschlossene einmalige Termine. Sie erscheinen weder im Dashboard
                noch in den Erinnerungen, bleiben dem Objekt aber erhalten und
                lassen sich jederzeit wieder aufnehmen.
              </Tipp>
              <div className="space-y-2">
                {inaktiv.map((t) => (
                  <InaktivZeile key={t.id} t={t} propertyId={property.id} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title="Katalog übernehmen">
            {notYetAdopted.length === 0 ? (
              <p className="text-sm text-gray-500">
                Alle Standard-Prüfpflichten sind bereits übernommen.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-600">
                  Übernimmt {notYetAdopted.length} noch fehlende Standard-Pflicht(en)
                  für dieses Objekt. Bereits vorhandene bleiben unberührt.
                </p>
                <ul className="mb-3 space-y-1 text-xs text-gray-500">
                  {notYetAdopted.map((d) => (
                    <li key={d.key}>
                      • {d.title}{" "}
                      <span className="text-gray-400">
                        ({maintenanceIntervalLabels[d.interval]})
                      </span>
                    </li>
                  ))}
                </ul>
                <form action={adoptComplianceCatalog}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <SubmitButton pendingLabel="Wird übernommen…">
                    Katalog übernehmen
                  </SubmitButton>
                </form>
              </>
            )}
          </Card>

          <Card title="Hinweis">
            <p className="text-sm text-gray-600">
              Prüfpflichten sind wiederkehrende Wartungsaufgaben. Sie lassen sich
              auch unter{" "}
              <Link href="/verwaltung/wartung" className="text-brand-green underline">
                Wartung &amp; Prüfungen
              </Link>{" "}
              gemeinsam mit weiteren Terminen verwalten, dort auch mit Handwerker-
              zuordnung und Vorgangserstellung.
            </p>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Heute ist der {formatDateOnly(new Date(today))}.
      </p>
    </>
  );
}

/**
 * Eine datierte Aufgabe mit ihren Handgriffen: erledigt, bearbeiten, ausblenden,
 * löschen.
 *
 * Prüfpflicht und eigener Termin sind derselbe Datensatz und werden deshalb
 * gleich bedient. „Erledigt" rechnet bei wiederkehrenden Aufgaben die nächste
 * Fälligkeit im Turnus aus und schließt einmalige ab — das gilt für einen
 * eigenen Termin genauso wie für die Trinkwasserprüfung.
 *
 * Das Bearbeiten steckt in einem eingeklappten `<details>`: Es ist der seltenere
 * Handgriff, und vier Felder je Zeile machten die Liste unlesbar, die man täglich
 * liest.
 */
function TerminKarte({
  t,
  propertyId,
  now,
}: {
  t: MaintenanceTask;
  propertyId: string;
  now: Date;
}) {
  const { days, status } = classifyDue(t.dueDate, now);
  const tone =
    status === "overdue"
      ? "border-red-300 bg-red-50"
      : status === "soon"
        ? "border-orange-300 bg-orange-50"
        : "border-gray-200 bg-white";
  return (
    <div
      id={`pflicht-${t.id}`}
      className={`scroll-mt-6 rounded-2xl border p-4 shadow-sm ${tone}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{t.title}</p>
          <p className="text-xs text-gray-500">
            {maintenanceIntervalLabels[t.interval]} · fällig am{" "}
            {formatDateOnly(t.dueDate)} · {dueLabel(days)}
            {t.lastDoneAt ? ` · zuletzt erledigt ${formatDateOnly(t.lastDoneAt)}` : ""}
          </p>
          {t.description ? (
            <p className="mt-1 text-sm text-gray-700">{t.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <form action={completeCompliance}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="id" value={t.id} />
            <PendingButton className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark">Erledigt</PendingButton>
          </form>
          <form action={setComplianceActive}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="aktiv" value="0" />
            <PendingButton
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              pendingLabel="Wird ausgeblendet…"
              title="Blendet den Eintrag aus Fahrplan, Dashboard und Erinnerungen aus — ohne ihn zu löschen."
            >
              Trifft nicht zu
            </PendingButton>
          </form>
          <form action={deleteCompliance}>
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="id" value={t.id} />
            <ConfirmActionButton
              className="text-xs text-red-600 hover:underline"
              confirmLabel="Wirklich löschen?"
              pendingLabel="Wird gelöscht…"
            >
              Löschen
            </ConfirmActionButton>
          </form>
        </div>
      </div>

      <details className="group mt-3 border-t border-gray-200/70 pt-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-600 hover:text-gray-900 marker:hidden [&::-webkit-details-marker]:hidden">
          Bearbeiten
        </summary>
        <form action={updateCompliance} className="mt-3 space-y-3">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="id" value={t.id} />
          <Field label="Titel">
            <input
              name="title"
              defaultValue={t.title}
              required
              minLength={2}
              maxLength={200}
              className={inputClass}
            />
          </Field>
          <Field label="Beschreibung">
            <textarea
              name="description"
              defaultValue={t.description ?? ""}
              rows={2}
              maxLength={2000}
              className={inputClass}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Turnus"
              name="interval"
              options={TURNUS_OPTIONEN}
              defaultValue={t.interval}
              required
            />
            <DateField
              label="Fällig am"
              name="dueDate"
              defaultValue={toDateInputValue(t.dueDate)}
              required
            />
          </div>
          <SubmitButton className={`${buttonSecondaryClass} ${buttonCompact}`}>
            Speichern
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

/**
 * Ein ausgeblendeter Eintrag — schmaler als die aktive Karte, denn hier gibt es
 * nur noch zwei Handgriffe: wieder aufnehmen oder endgültig löschen.
 */
function InaktivZeile({ t, propertyId }: { t: MaintenanceTask; propertyId: string }) {
  // Abgeschlossene einmalige Termine tragen dieselbe Kennzeichnung wie die
  // ausgeblendeten Pflichten. Unterscheidbar sind sie am Turnus und daran, dass
  // sie quittiert wurden — und der Unterschied gehört in die Zeile, sonst steht
  // ein erledigter Termin unter „trifft nicht zu".
  const abgeschlossen = t.interval === "EINMALIG" && t.lastDoneAt !== null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white/70 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-gray-700">{t.title}</p>
        <p className="text-xs text-gray-500">
          {abgeschlossen
            ? `abgeschlossen am ${formatDateOnly(t.lastDoneAt!)}`
            : "ausgeblendet: trifft auf dieses Objekt nicht zu"}{" "}
          · {maintenanceIntervalLabels[t.interval]}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <form action={setComplianceActive}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="aktiv" value="1" />
          <PendingButton
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            pendingLabel="Wird aufgenommen…"
          >
            Wieder aufnehmen
          </PendingButton>
        </form>
        <form action={deleteCompliance}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="id" value={t.id} />
          <ConfirmActionButton
            className="text-xs text-red-600 hover:underline"
            confirmLabel="Wirklich löschen?"
            pendingLabel="Wird gelöscht…"
          >
            Löschen
          </ConfirmActionButton>
        </form>
      </div>
    </div>
  );
}
