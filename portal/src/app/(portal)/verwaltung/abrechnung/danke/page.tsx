import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, PageTitle, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { productName } from "@/lib/app-mode";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Danke-Seite nach dem Bezahlen: Ziel der Stripe-Checkout-Rückkehr
 * (`success_url` in `../actions.ts`).
 *
 * Vorher führte der Checkout nur zurück auf die Abrechnungs-Seite mit einem
 * schmalen Hinweis-Banner — nach einem Bezahlvorgang ist das zu wenig
 * Rückmeldung. Hier steht der Dank im Mittelpunkt, dazu der Weg zurück ins
 * Portal und was als Nächstes passiert.
 *
 * Gleiche Hürde wie die Abrechnungs-Seite selbst (SuperAdmin) — die Seite
 * verrät zwar nichts, aber sie gehört zum Abrechnungs-Bereich.
 */
export default async function DankePage() {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/abrechnung", label: "Abrechnung" }}>
        Vielen Dank!
      </PageTitle>

      <Card>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-good-light">
            <CheckCircle2 className="h-6 w-6 text-good" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              Ihre Zahlung ist eingegangen — danke für Ihr Vertrauen!
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-700">
              Ihr Abo wird jetzt aktiviert; das dauert höchstens einen Moment.
              Eine Bestätigung mit Rechnung erhalten Sie per E-Mail. Für Ihre
              Gemeinschaft ändert sich sonst nichts: Alle Daten, Zugänge und
              Einstellungen bleiben genau so, wie sie sind — Sie können direkt
              in {productName()} weiterarbeiten.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/dashboard" className={buttonClass}>
                Weiter ins Portal
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/verwaltung/abrechnung" className={buttonSecondaryClass}>
                Abo &amp; Rechnungen ansehen
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
