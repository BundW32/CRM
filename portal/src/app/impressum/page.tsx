import Link from "next/link";
import { BwLogo } from "@/components/logo";

export const dynamic = "force-static";

export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
        <BwLogo className="mb-6 h-14 w-auto" />
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Impressum</h1>

        <div className="space-y-4 text-sm text-gray-700">
          <section>
            <h2 className="font-semibold text-gray-900">Angaben gemäß § 5 DDG</h2>
            <p>
              B&amp;W Immobilien Management UG (haftungsbeschränkt)
              <br />
              Goethestraße 42
              <br />
              45964 Gladbeck
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">Vertreten durch</h2>
            <p>Geschäftsführer: Alexander Wachtel</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">Kontakt</h2>
            <p>
              E-Mail:{" "}
              <a href="mailto:info@bundwimmobilien.de" className="text-brand-green hover:underline">
                info@bundwimmobilien.de
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">Registereintrag</h2>
            <p>
              Registergericht: [bitte ergänzen]
              <br />
              Registernummer: [bitte ergänzen]
              <br />
              Umsatzsteuer-IdNr. (§ 27 a UStG): [bitte ergänzen]
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p>Alexander Wachtel, Anschrift wie oben</p>
          </section>
        </div>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/login" className="text-brand-green hover:underline">
            ← Zur Anmeldung
          </Link>
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>
        </div>
      </div>
    </main>
  );
}
