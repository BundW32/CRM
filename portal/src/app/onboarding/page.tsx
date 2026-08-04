import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { isSelfManaged } from "@/lib/access";
import { orgLogoUrl } from "@/lib/branding";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { BrandingForm, type BrandingDefaults } from "@/app/(portal)/verwaltung/branding/branding-form";
import { completeOnboarding } from "@/app/(portal)/verwaltung/branding/actions";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/dashboard");

  const org = await getOrganization();
  if (!org) redirect("/dashboard");
  // Selbstverwaltete WEGs überspringen die Branding-Einrichtung (kein eigenes
  // Logo/Firmenname) und gehen direkt zum geführten Erststart auf der Übersicht.
  //
  // Bewusst NICHT nach `/verwaltung`: Das leitet weiter auf die WEG-Finanzen,
  // und die sind für eine frisch registrierte Gemeinschaft zwangsläufig leer –
  // es gibt ja noch kein Objekt. Genau dieser erste Eindruck war der Anlass für
  // den Einrichtungs-Assistenten; ihn dann nicht anzusteuern, hieße den Weg zu
  // bauen und die Weiche stehen zu lassen.
  if (isSelfManaged(org)) redirect("/dashboard");
  const { fehler } = await searchParams;

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
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <p className="mb-1 text-center text-sm font-medium text-gray-400">
            Willkommen{verwalter.firstName ? `, ${verwalter.firstName}` : ""}
          </p>
          <h1 className="mb-2 text-center text-xl font-bold text-brand-green">
            Richten Sie Ihr Portal ein
          </h1>
          <p className="mx-auto mb-6 max-w-lg text-center text-sm text-gray-600">
            Geben Sie Ihrem Kundenportal das Erscheinungsbild{" "}
            {org.accountType === "selbstverwalter" ? "Ihrer WEG" : "Ihrer Hausverwaltung"} – mit
            eigenem Logo, Ihrer Farbe und Ihren Kontaktdaten. Sie können alles später unter
            <span className="font-medium"> Verwaltung → Branding</span> ändern.
          </p>

          {fehler ? (
            <Alert variant="error" className="mb-4">{fehler}</Alert>
          ) : null}

          <BrandingForm
            action={completeOnboarding}
            defaults={defaults}
            submitLabel="Einrichtung abschließen →"
          />

          <p className="mt-4 text-center text-xs text-gray-400">
            <a href="/dashboard" className="underline hover:text-gray-600">
              Später einrichten
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
