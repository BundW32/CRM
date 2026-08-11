import Link from "next/link";
import { AdsKonversion } from "@/components/ads-konversion";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

const RESULTS = {
  ok: {
    title: "E-Mail bestätigt",
    body: "Vielen Dank! Ihre E-Mail-Adresse ist nun bestätigt.",
    tone: "text-brand-green",
  },
  expired: {
    title: "Link abgelaufen",
    body: "Dieser Bestätigungslink ist abgelaufen. Bitte fordern Sie im Portal einen neuen an.",
    tone: "text-amber-700",
  },
  invalid: {
    title: "Link ungültig",
    body: "Dieser Bestätigungslink ist ungültig oder wurde bereits verwendet.",
    tone: "text-gray-700",
  },
  limit: {
    title: "Zu viele Versuche",
    body: "Von diesem Anschluss sind zu viele Bestätigungen eingegangen. Bitte warten Sie eine Stunde und öffnen Sie den Link dann erneut.",
    tone: "text-amber-700",
  },
} as const;

export default async function VerifyResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const result = RESULTS[(status as keyof typeof RESULTS) ?? "invalid"] ?? RESULTS.invalid;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      {/* Der Punkt, an dem aus einem Anzeigenklick eine echte Anmeldung
          geworden ist: E-Mail bestätigt. Das Absenden des Formulars wäre zu
          früh — eine unbestätigte Adresse ist keine Registrierung, und Google
          würde auf Tippfehler und Wegwerf-Adressen hin optimieren. Meldet nur
          nach Einwilligung und nur, wenn im Ads-Konto eine Konversionsaktion
          hinterlegt ist. */}
      {status === "ok" && isWegSaas() ? <AdsKonversion ereignis="registrierung" /> : null}
      <div className="w-full max-w-sm animate-page-in">
        <div className="rounded-2xl border border-white/10 bg-white p-8 text-center shadow-2xl shadow-black/30">
          <h1 className={`mb-2 text-xl font-bold ${result.tone}`}>{result.title}</h1>
          <p className="mb-6 text-sm text-gray-600">{result.body}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
          >
            Zum Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
