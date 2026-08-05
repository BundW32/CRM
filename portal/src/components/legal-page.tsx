import Link from "next/link";
import type { ReactNode } from "react";
import { PublicBrand } from "@/components/public-brand";
import { isWegSaas } from "@/lib/app-mode";

// Gemeinsames Layout für Rechtsseiten (Impressum-Stil: weiße Karte auf dunklem
// Shell). Optionaler Entwurfs-Hinweis, einheitliche Fußzeilen-Links.
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function LegalPage({
  title,
  draft = false,
  intro,
  children,
}: {
  title: string;
  draft?: boolean;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className={`rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30 ${isWegSaas() ? "wp-brand" : ""}`}>
        <PublicBrand />
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{title}</h1>

        {draft ? (
          <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Entwurf – noch nicht rechtsverbindlich geprüft.</strong> Diese Fassung
            dient der Vorbereitung und ersetzt keine anwaltliche Prüfung.
          </p>
        ) : null}

        {intro ? <div className="mb-6 text-sm text-gray-700">{intro}</div> : null}

        <div className="space-y-5 text-sm leading-relaxed text-gray-700">{children}</div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/login" className="text-brand-green hover:underline">
            ← Zur Anmeldung
          </Link>
          <Link href="/impressum" className="text-brand-green hover:underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutz
          </Link>
          <Link href="/ki-transparenz" className="text-brand-green hover:underline">
            KI-Transparenz
          </Link>
          <Link href="/agb" className="text-brand-green hover:underline">
            AGB
          </Link>
          {/* Nur wegportal24: Dort ist die Kundin eine WEG und damit
              Verbraucherin. Auf der B&W-Tür ist der Kunde Unternehmer — die
              Seite gibt es dort nicht (404), ein Link liefe ins Leere. */}
          {isWegSaas() ? (
            <>
              <Link href="/widerruf" className="text-brand-green hover:underline">
                Widerruf
              </Link>
              {/* § 312k Abs. 2 BGB — die Beschriftung gibt das Gesetz vor. */}
              <Link href="/kuendigen" className="text-brand-green hover:underline">
                Verträge hier kündigen
              </Link>
            </>
          ) : null}
          <Link href="/avv" className="text-brand-green hover:underline">
            AVV
          </Link>
        </div>
      </div>
    </main>
  );
}
