import Link from "next/link";
import { notFound } from "next/navigation";
import { BwLogo } from "@/components/logo";
import { buttonSecondaryClass } from "@/components/ui";
import { db } from "@/lib/db";
import { portalUrl } from "@/lib/mailer";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function ZugangsschreibenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pw?: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;
  const { pw } = await searchParams;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      tenancies: {
        where: { active: true },
        include: { unit: { include: { property: true } } },
      },
      ownerships: { include: { property: true } },
    },
  });
  if (!user) notFound();

  const loginName = user.email ?? user.username ?? "—";
  const loginUrl = portalUrl("/login");

  // Anschrift (sofern über Wohnung/Objekt bekannt)
  const tenancy = user.tenancies[0];
  const ownership = user.ownerships[0];
  const objekt = tenancy?.unit.property ?? ownership?.property ?? null;
  const einheit = tenancy?.unit ?? null;

  return (
    <main className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      {/* Steuerleiste – nicht im Druck */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-6">
        <Link href="/verwaltung/nutzer" className={buttonSecondaryClass}>
          ← Zurück zu Nutzer
        </Link>
        <PrintButton />
      </div>

      {!pw ? (
        <div className="no-print mx-auto mb-4 max-w-3xl rounded-md bg-amber-50 px-6 py-3 text-sm text-amber-800">
          Das Erst-Passwort kann aus Sicherheitsgründen nur direkt nach der Erstellung
          angezeigt werden. Über „Nutzer → Zugangsschreiben neu erstellen“ können Sie ein
          neues Erst-Passwort erzeugen.
        </div>
      ) : null}

      {/* Das eigentliche A4-Schreiben */}
      <div className="print-sheet mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-12 shadow-sm">
        <div className="mb-10 flex items-start justify-between">
          <BwLogo />
          <div className="text-right text-xs text-gray-500">
            <p className="font-semibold text-brand-green">
              B&amp;W Immobilien Management UG
            </p>
            <p>Goethestraße 42</p>
            <p>45964 Gladbeck</p>
            <p>info@bundwimmobilien.de</p>
            <p>www.bundwimmobilien.de</p>
          </div>
        </div>

        {/* Anschriftfeld */}
        <div className="mb-10 text-sm text-gray-800">
          <p className="font-medium">{user.salutation ? `${user.salutation} ` : ""}{user.name}</p>
          {objekt ? (
            <>
              <p>
                {objekt.street}
                {einheit ? ` · ${einheit.label}` : ""}
              </p>
              <p>
                {objekt.zip} {objekt.city}
              </p>
            </>
          ) : null}
        </div>

        <p className="mb-6 text-right text-xs text-gray-500">
          Gladbeck, {formatDate(new Date())}
        </p>

        <h1 className="mb-4 text-lg font-bold text-brand-green">
          Ihr persönlicher Zugang zum B&amp;W Kundenportal
        </h1>

        <div className="space-y-4 text-sm leading-relaxed text-gray-800">
          <p>
            {user.salutation === "Herr"
              ? `Sehr geehrter Herr ${user.lastName ?? user.name},`
              : user.salutation === "Frau"
              ? `Sehr geehrte Frau ${user.lastName ?? user.name},`
              : `Guten Tag ${user.name},`}
          </p>
          <p>
            ab sofort steht Ihnen unser Kundenportal zur Verfügung. Dort können Sie
            {user.role === "MIETER"
              ? " Schäden melden, den Bearbeitungsstand verfolgen, Dokumente einsehen und Aushänge lesen."
              : " Ihre Objektinformationen, Vorgänge, Statistiken und Dokumente einsehen."}
          </p>

          <div className="my-6 rounded-lg border-2 border-brand-orange bg-brand-orange-light p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-orange-dark">
              Ihre Zugangsdaten
            </p>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="py-1 pr-6 align-top font-medium text-gray-600">Portal-Adresse:</td>
                  <td className="py-1 font-mono text-gray-900">{loginUrl}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-6 align-top font-medium text-gray-600">
                    {user.email ? "Benutzername (E-Mail):" : "Benutzername:"}
                  </td>
                  <td className="py-1 font-mono text-gray-900">{loginName}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-6 align-top font-medium text-gray-600">Erst-Passwort:</td>
                  <td className="py-1 font-mono text-lg font-bold text-gray-900">
                    {pw ?? "— (bitte neu erstellen) —"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 pr-6 align-top font-medium text-gray-600">Rolle:</td>
                  <td className="py-1 text-gray-900">{roleLabels[user.role]}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            <strong>Wichtig:</strong> Bitte ändern Sie das Erst-Passwort bei Ihrer ersten
            Anmeldung. Sie werden automatisch dazu aufgefordert. Bewahren Sie dieses
            Schreiben sorgfältig auf und geben Sie Ihre Zugangsdaten nicht an Dritte weiter.
          </p>
          <p>
            Bei Fragen erreichen Sie uns unter info@bundwimmobilien.de. Wir helfen Ihnen
            gerne weiter.
          </p>
          <p className="pt-4">
            Mit freundlichen Grüßen
            <br />
            <span className="font-semibold text-brand-green">
              B&amp;W Immobilien Management UG
            </span>
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400">
          B&amp;W Immobilien Management UG (haftungsbeschränkt) · Goethestraße 42, 45964
          Gladbeck · info@bundwimmobilien.de · www.bundwimmobilien.de
        </div>
      </div>
    </main>
  );
}
