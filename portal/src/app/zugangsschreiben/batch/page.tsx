import { notFound } from "next/navigation";
import { BackLink, Alert } from "@/components/ui";
import { LetterHead, letterFooterLine } from "@/components/letter-branding";
import { db } from "@/lib/db";
import { brandingFromOrg, orgLogoUrl } from "@/lib/branding";
import { portalUrl } from "@/lib/mailer";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { liesErstzugaenge } from "@/lib/zugangsschreiben";
import { PrintButton } from "../[id]/print-button";

export const dynamic = "force-dynamic";

export default async function BatchZugangsschreibenPage() {
  const verwalter = await requireVerwalter();
  // Früher `?u=id~pw~id~pw~…`: ein ganzes Objekt voller Klartext-Passwörter in
  // der Adresszeile, und damit in jedem Zugriffsprotokoll auf dem Weg dorthin.
  // Jetzt aus dem kurzlebigen Cookie — siehe `lib/zugangsschreiben.ts`.
  const zugaenge = await liesErstzugaenge();
  if (zugaenge.size === 0) notFound();

  const users = await db.user.findMany({
    // Org-Wand: nur Zugangsschreiben für Nutzer der eigenen Org drucken.
    where: { id: { in: [...zugaenge.keys()] }, organizationId: verwalter.organizationId },
    include: {
      tenancies: {
        where: { active: true },
        include: { unit: { include: { property: true } } },
      },
      ownerships: { include: { property: true } },
    },
  });

  // Die Organisations-Wand oben entscheidet, wer gedruckt wird — das Cookie ist
  // ein Transportmittel, keine Berechtigung.
  const letters = users.map((user) => ({ user, pw: zugaenge.get(user.id)! }));

  if (letters.length === 0) notFound();

  const org = await db.organization.findUnique({ where: { id: verwalter.organizationId } });
  const branding = brandingFromOrg(org);
  const logoUrl = org ? orgLogoUrl(org) : "/bw-logo.png";

  const loginUrl = portalUrl("/login");

  return (
    <main className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-6">
        <BackLink href="/verwaltung/nutzer" tone="onLight">Zurück zu Nutzer</BackLink>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{letters.length} Schreiben</span>
          <PrintButton />
        </div>
      </div>

      <Alert variant="warning" className="no-print mx-auto mb-4 max-w-3xl">
        Drucken Sie alle Schreiben jetzt aus. Die Erst-Passwörter werden aus
        Sicherheitsgründen nicht gespeichert und können später nur durch neue Schreiben
        ersetzt werden.
      </Alert>

      {letters.map(({ user, pw }, idx) => {
        const loginName = user.email ?? user.username ?? "—";
        const tenancy = user.tenancies[0];
        const ownership = user.ownerships[0];
        const objekt = tenancy?.unit.property ?? ownership?.property ?? null;
        const einheit = tenancy?.unit ?? null;

        return (
          <div
            key={user.id}
            className={`print-sheet mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-12 shadow-sm ${idx > 0 ? "mt-8 print:mt-0 print:break-before-page" : ""}`}
          >
            <LetterHead branding={branding} logoUrl={logoUrl} />

            <div className="mb-10 text-sm text-gray-800">
              <p className="font-medium">{user.name}</p>
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
              {branding.city ? `${branding.city}, ` : ""}{formatDate(new Date())}
            </p>

            <h1 className="mb-4 text-lg font-bold text-brand-green">
              Ihr persönlicher Zugang zum Kundenportal
            </h1>

            <div className="space-y-4 text-sm leading-relaxed text-gray-800">
              <p>Sehr geehrte/r {user.name},</p>
              <p>
                ab sofort steht Ihnen unser Kundenportal zur Verfügung. Dort können Sie
                {user.role === "MIETER"
                  ? " Schäden melden, den Bearbeitungsstand verfolgen, Dokumente einsehen und Aushänge lesen."
                  : " Ihre Objektinformationen, Vorgänge und Dokumente einsehen."}
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
                      <td className="py-1 font-mono text-lg font-bold text-gray-900">{pw}</td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-6 align-top font-medium text-gray-600">Rolle:</td>
                      <td className="py-1 text-gray-900">{roleLabels[user.role]}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                <strong>Wichtig:</strong> Bitte ändern Sie das Erst-Passwort bei Ihrer
                ersten Anmeldung. Sie werden automatisch dazu aufgefordert.
              </p>
              {branding.email ? (
                <p>Bei Fragen erreichen Sie uns unter {branding.email}.</p>
              ) : null}
              <p className="pt-4">
                Mit freundlichen Grüßen
                <br />
                <span className="font-semibold text-brand-green">{branding.legalName}</span>
              </p>
            </div>

            <div className="mt-12 border-t border-gray-200 pt-4 text-center text-[10px] text-gray-400">
              {letterFooterLine(branding)}
            </div>
          </div>
        );
      })}
    </main>
  );
}
