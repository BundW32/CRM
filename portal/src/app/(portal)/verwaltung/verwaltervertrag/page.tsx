import { redirect } from "next/navigation";
import { FileDown } from "lucide-react";
import { Card, PageTitle, buttonClass } from "@/components/ui";
import { Tipp } from "@/components/tipp";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { SETTINGS_HREF } from "@/lib/app-nav";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Mustervertrag für die Selbstverwaltung: Verwaltervertrag zwischen der
 * Gemeinschaft und dem aus ihrer Mitte bestellten Verwalter — als PDF,
 * vorausgefüllt mit Objekt und Absender, alles Weitere trägt die
 * Gemeinschaft von Hand ein und beschließt es in der Versammlung.
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
    select: {
      id: true,
      name: true,
      street: true,
      zip: true,
      city: true,
      _count: { select: { units: true } },
    },
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
              Haftung und die Herausgabe der Unterlagen am Ende. Dieses Muster bringt
              alle diese Punkte mit; Objekt und Absender sind bereits eingetragen,
              die Vereinbarungen selbst füllt Ihre Gemeinschaft aus.
            </p>
            <p>
              Der Weg: Muster herunterladen, gemeinsam ausfüllen, in der Versammlung
              Bestellung und Vertragsabschluss beschließen — und für die Gemeinschaft
              unterschreibt ein anderer, durch den Beschluss ermächtigter Eigentümer
              (nicht der Verwalter selbst, § 181 BGB).
            </p>
          </div>
        </Card>

        <Card title="Muster herunterladen">
          {properties.length === 0 ? (
            <p className="text-sm text-gray-600">
              Es ist noch kein WEG-Objekt angelegt. Legen Sie zuerst Ihr Objekt an —
              danach steht das Muster hier mit den Daten Ihrer Gemeinschaft bereit.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {properties.map((property) => (
                <li
                  key={property.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{property.name}</p>
                    <p className="text-xs text-gray-500">
                      {property.street}, {property.zip} {property.city} ·{" "}
                      {property._count.units}{" "}
                      {property._count.units === 1 ? "Einheit" : "Einheiten"}
                    </p>
                  </div>
                  <a
                    href={`/verwaltung/verwaltervertrag/pdf?objekt=${property.id}&download=1`}
                    className={buttonClass}
                  >
                    <FileDown className="h-4 w-4" />
                    Als PDF
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>

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
