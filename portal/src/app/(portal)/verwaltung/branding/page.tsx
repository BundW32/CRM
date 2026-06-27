import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { orgLogoUrl } from "@/lib/branding";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { BrandingForm, type BrandingDefaults } from "./branding-form";
import { updateBranding } from "./actions";

export const dynamic = "force-dynamic";

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ gespeichert?: string; fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");

  const org = await getOrganization();
  if (!org) redirect("/verwaltung");
  const { gespeichert, fehler } = await searchParams;

  const defaults: BrandingDefaults = {
    name: org.name ?? "",
    slug: org.slug ?? "",
    legalName: org.legalName ?? "",
    primaryColor: org.primaryColor ?? "",
    email: org.email ?? "",
    phone: org.phone ?? "",
    website: org.website ?? "",
    street: org.street ?? "",
    zip: org.zip ?? "",
    city: org.city ?? "",
    logoUrl: org.logoStoredName ? orgLogoUrl(org) : null,
  };

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung" className={buttonSecondaryClass}>
            ← Verwaltung
          </Link>
        }
      >
        Branding &amp; Erscheinungsbild
      </PageTitle>

      {gespeichert ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Branding gespeichert. Logo, Farbe und Impressum sind aktualisiert.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{fehler}</p>
      ) : null}

      <Card>
        <p className="mb-5 text-sm text-gray-600">
          Passen Sie das Portal an Ihre Hausverwaltung an: eigenes Logo, Akzentfarbe und
          Impressumsdaten. Diese erscheinen in der Kopf- und Fußzeile sowie auf Schreiben an
          Ihre Kunden.
        </p>
        <BrandingForm action={updateBranding} defaults={defaults} submitLabel="Speichern" />
      </Card>
    </>
  );
}
