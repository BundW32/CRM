import Link from "next/link";
import { NICHT_INDEXIEREN } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neue E-Mail-Adresse bestätigen",
  description: "Rückmeldung zum Bestätigungslink für die geänderte E-Mail-Adresse.",
  robots: NICHT_INDEXIEREN,
};

// Eigene Ergebnisseite statt eines Rücksprungs auf „Konto": Der Link wird im
// Postfach geöffnet, oft auf einem Gerät ohne angemeldete Sitzung. Hinter der
// Anmeldeschranke stünde dort die Login-Maske — und damit die Frage nach genau
// der Adresse, die sich gerade geändert hat.
//
// Jede Meldung sagt, was jetzt gilt und was zu tun ist. „Ungültig" heißt hier
// meistens „bereits eingelöst": Der Token wird beim Übernehmen entfernt, ein
// zweiter Klick auf denselben Link findet ihn nicht mehr.
const ERGEBNISSE = {
  ok: {
    title: "E-Mail-Adresse geändert",
    body: "Ihre neue Adresse ist bestätigt und ab sofort zugleich Ihr Anmeldename.",
    tone: "text-brand-green",
  },
  abgelaufen: {
    title: "Link abgelaufen",
    body: "Dieser Bestätigungslink war 24 Stunden gültig. Ihre bisherige Adresse gilt unverändert weiter — fordern Sie die Änderung unter „Konto“ erneut an.",
    tone: "text-amber-700",
  },
  vergeben: {
    title: "Adresse bereits vergeben",
    body: "Diese E-Mail-Adresse gehört inzwischen zu einem anderen Zugang. Jede Adresse kann nur einem Konto zugeordnet sein; bitte wählen Sie unter „Konto“ eine andere.",
    tone: "text-amber-700",
  },
  ungueltig: {
    title: "Link ungültig",
    body: "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet. Ihre bisherige Adresse gilt unverändert weiter.",
    tone: "text-gray-700",
  },
  limit: {
    title: "Zu viele Versuche",
    body: "Von diesem Anschluss sind zu viele Bestätigungen eingegangen. Bitte warten Sie eine Stunde und öffnen Sie den Link dann erneut.",
    tone: "text-amber-700",
  },
} as const;

export default async function EmailWechselErgebnisPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ergebnis =
    ERGEBNISSE[(status as keyof typeof ERGEBNISSE) ?? "ungueltig"] ?? ERGEBNISSE.ungueltig;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm animate-page-in">
        <div className="rounded-2xl border border-white/10 bg-white p-8 text-center shadow-2xl shadow-black/30">
          <h1 className={`mb-2 text-xl font-bold ${ergebnis.tone}`}>{ergebnis.title}</h1>
          <p className="mb-6 text-sm text-gray-600">{ergebnis.body}</p>
          <Link
            href="/konto"
            className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
          >
            Zum Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
