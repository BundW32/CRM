import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBrand } from "@/components/public-brand";
import { isWegSaas } from "@/lib/app-mode";
import { NICHT_INDEXIEREN } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kündigung eingegangen",
  description: "Bestätigung des Eingangs Ihrer Kündigungserklärung nach § 312k BGB.",
  robots: NICHT_INDEXIEREN,
};

/**
 * Bestätigung nach § 312k Abs. 4 BGB.
 *
 * Das Gesetz verlangt, dass der Verbraucher die Erklärung samt Inhalt, Datum
 * und Uhrzeit des Zugangs und dem Zeitpunkt der Beendigung „in Textform“
 * bestätigt bekommt — deshalb geht die eigentliche Bestätigung per E-Mail
 * raus. Diese Seite sagt nur, dass es geklappt hat: Ein Formular, das nach dem
 * Absenden schweigt, lässt den Kündigenden im Unklaren, ob seine Erklärung
 * angekommen ist — und genau davor soll ihn die Vorschrift bewahren.
 */
export default function KuendigungBestaetigtPage() {
  if (!isWegSaas()) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="wp-brand rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
        <PublicBrand />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Ihre Kündigung ist eingegangen</h1>

        <div className="space-y-3 text-sm text-gray-700">
          <p>
            Wir haben Ihre Kündigungserklärung erhalten. Eine Bestätigung mit dem Inhalt
            Ihrer Erklärung und dem Zeitpunkt des Zugangs ist an die von Ihnen angegebene
            E-Mail-Adresse unterwegs.
          </p>
          <p>
            Den genauen Zeitpunkt der Vertragsbeendigung teilen wir Ihnen gesondert mit.
            Nach den AGB endet der Vertrag zum Ende des laufenden Abrechnungsmonats, sofern
            kein anderer Zeitpunkt gilt.
          </p>
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <strong>Ihr Zugang bleibt bis dahin unverändert nutzbar.</strong> Ihre Daten
            können Sie über die Export-Funktionen jederzeit sichern — auch noch mindestens
            30 Tage nach dem Vertragsende.
          </p>
          <p className="text-gray-500">
            Sollte die Bestätigung nicht innerhalb weniger Minuten ankommen, sehen Sie bitte
            im Spam-Ordner nach oder schreiben Sie an{" "}
            <a href="mailto:info@wegportal24.de" className="text-brand-green hover:underline">
              info@wegportal24.de
            </a>
            .
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-brand-green hover:underline">
            ← Zur Startseite
          </Link>
          <Link href="/login" className="text-brand-green hover:underline">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    </main>
  );
}
