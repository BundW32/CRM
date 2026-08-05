import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { DateField, SelectField } from "@/components/fields";
import { Tipp } from "@/components/tipp";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { SETTINGS_HREF } from "@/lib/app-nav";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Mustervertrag für die Selbstverwaltung: Verwaltervertrag zwischen der
 * Gemeinschaft und dem aus ihrer Mitte bestellten Verwalter.
 *
 * Die Seite ist ein Ausfüll-Formular: Alle Vereinbarungen (Namen, Laufzeit,
 * Vergütung, Grenzen) lassen sich hier eintragen, und das PDF kommt fertig
 * ausgefüllt heraus — es bleibt nur die Unterschrift. Jedes Feld ist
 * freiwillig: Was leer bleibt, wird im PDF eine Ausfülllinie, das Formular
 * taugt also auch für das leere Muster.
 *
 * Bewusst ein GET-Formular direkt auf die PDF-Route: Die Angaben werden
 * nirgends gespeichert — sie gehören in den Beschluss der Versammlung und in
 * das unterschriebene Papier, nicht in die Datenbank.
 *
 * Nur für selbstverwaltete WEGs: Bei professionellen Verwaltungen schließt
 * die Gemeinschaft ihren Vertrag mit der Verwaltung, nicht mit einem
 * Miteigentümer.
 */
export default async function VerwaltervertragPage() {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();
  if (!org || !isSelfManaged(org)) redirect("/verwaltung");

  const properties = await db.property.findMany({
    where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, street: true, zip: true, city: true },
  });

  return (
    <>
      <PageTitle back={{ href: SETTINGS_HREF, label: "Einstellungen" }}>
        Verwaltervertrag (Muster)
      </PageTitle>

      <div className="space-y-4">
        <Card title="Wofür dieses Muster da ist">
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              Auch in der Selbstverwaltung wird der Verwalter durch Beschluss bestellt
              (§ 26 Abs. 1 WEG) — und ein Vertrag regelt, was sonst offen bliebe:
              Aufgaben, Laufzeit, Vergütung oder Ehrenamt, Grenzen ohne Beschluss,
              Haftung und die Herausgabe der Unterlagen am Ende.
            </p>
            <p>
              Füllen Sie die Punkte unten aus — das PDF kommt fertig ausgefüllt
              heraus, es bleibt nur die Unterschrift. Was Sie leer lassen, wird im
              PDF eine Ausfülllinie zum handschriftlichen Ergänzen. Gespeichert
              wird hier nichts: Die Angaben gehören in den Beschluss der
              Versammlung und auf das unterschriebene Papier.
            </p>
          </div>
        </Card>

        {properties.length === 0 ? (
          <Card title="Vertrag ausfüllen">
            <p className="text-sm text-gray-600">
              Es ist noch kein WEG-Objekt angelegt. Legen Sie zuerst Ihr Objekt an —
              danach steht das Muster hier mit den Daten Ihrer Gemeinschaft bereit.
            </p>
          </Card>
        ) : (
          <Card title="Vertrag ausfüllen">
            <form action="/verwaltung/verwaltervertrag/pdf" method="GET" className="space-y-5">
              <input type="hidden" name="download" value="1" />
              {properties.length === 1 ? (
                <input type="hidden" name="objekt" value={properties[0].id} />
              ) : (
                <SelectField
                  label="WEG-Objekt"
                  name="objekt"
                  options={properties.map((p) => ({
                    value: p.id,
                    label: `${p.name} — ${p.street}, ${p.zip} ${p.city}`,
                  }))}
                />
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Personen</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Verwalter/in (Name)">
                    <input
                      type="text"
                      name="verwalter"
                      maxLength={120}
                      placeholder="z. B. Erika Mustermann"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Anschrift des Verwalters">
                    <input
                      type="text"
                      name="verwalterAnschrift"
                      maxLength={200}
                      placeholder="Straße, PLZ Ort"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Unterschreibt für die Gemeinschaft (Name)">
                    <input
                      type="text"
                      name="vertreter"
                      maxLength={120}
                      placeholder="z. B. Vorsitz des Beirats"
                      className={inputClass}
                    />
                  </Field>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Für die Gemeinschaft unterschreibt ein durch den Beschluss ermächtigter
                  Eigentümer — nicht der Verwalter selbst (§ 181 BGB).
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">
                  Beschluss und Laufzeit
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateField label="Bestellungs-Beschluss vom" name="beschluss" />
                  <Field label="Tagesordnungspunkt (TOP)">
                    <input
                      type="text"
                      name="top"
                      maxLength={20}
                      placeholder="z. B. 4"
                      className={inputClass}
                    />
                  </Field>
                  <DateField label="Bestellung beginnt am" name="beginn" />
                  <DateField
                    label="Befristet bis"
                    name="ende"
                    hint="Höchstens 5 Jahre, bei Erstbestellung 3 Jahre (§ 26 Abs. 2 WEG)"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">Vergütung</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SelectField
                    label="Art"
                    name="verguetung"
                    placeholder="— im PDF offen lassen —"
                    options={[
                      { value: "EHRENAMT", label: "Ehrenamtlich, ohne Vergütung" },
                      { value: "AUFWAND", label: "Aufwandsentschädigung" },
                    ]}
                  />
                  <Field label="Betrag (€)">
                    <input
                      type="text"
                      inputMode="decimal"
                      name="betrag"
                      maxLength={20}
                      placeholder="z. B. 600"
                      className={inputClass}
                    />
                  </Field>
                  <SelectField
                    label="je"
                    name="intervall"
                    placeholder="—"
                    options={[
                      { value: "MONAT", label: "Monat" },
                      { value: "JAHR", label: "Jahr" },
                    ]}
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Betrag und Zeitraum werden nur gebraucht, wenn eine
                  Aufwandsentschädigung vereinbart ist.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">
                  Grenzen und Besonderes
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Ohne Beschluss bis (€ je Einzelfall)">
                    <input
                      type="text"
                      inputMode="decimal"
                      name="grenze"
                      maxLength={20}
                      placeholder="z. B. 500"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Haftungsgrenze bei einfacher Fahrlässigkeit (€)">
                    <input
                      type="text"
                      inputMode="decimal"
                      name="haftung"
                      maxLength={20}
                      placeholder="z. B. 10.000"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Gesondert vergütete Leistungen (optional)">
                    <input
                      type="text"
                      name="sonder"
                      maxLength={300}
                      placeholder="z. B. zusätzliche Versammlung 150 €"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Ort für die Unterschriftszeile">
                    <input
                      type="text"
                      name="ort"
                      maxLength={80}
                      defaultValue={properties[0].city}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>

              <button type="submit" className={buttonClass}>
                <FileDown className="h-4 w-4" />
                Ausgefülltes PDF herunterladen
              </button>
            </form>
          </Card>
        )}

        <Tipp>
          Das Muster ist eine allgemeine Vorlage und keine Rechtsberatung. In
          Gemeinschaften mit weniger als neun Sondereigentumsrechten braucht der
          bestellte Miteigentümer keine Zertifizierung nach § 26a WEG, solange nicht
          ein Drittel der Eigentümer sie verlangt (§ 19 Abs. 2 Nr. 6 WEG).
        </Tipp>
      </div>
    </>
  );
}
