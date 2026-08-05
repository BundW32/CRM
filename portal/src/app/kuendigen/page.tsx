import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBrand } from "@/components/public-brand";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, inputClass } from "@/components/ui";
import { SelectField } from "@/components/fields";
import { isWegSaas } from "@/lib/app-mode";
import { erklaereKuendigung } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Kündigungsschaltfläche nach § 312k BGB.
 *
 * Pflicht für Verbraucherverträge über eine entgeltliche Dauerleistung, die
 * online geschlossen werden können. Eine WEG ist Verbraucherin (BGH
 * VIII ZR 243/13), der Vertrag läuft auf unbestimmte Zeit — also gilt sie hier.
 *
 * Drei Anforderungen, die das Gesetz an die Gestaltung stellt und die man
 * leicht übersieht:
 *   1. Die Schaltfläche heißt „Verträge hier kündigen“ oder entsprechend
 *      eindeutig und führt unmittelbar zu dieser Seite (Abs. 2 Satz 3).
 *   2. Der Bestätigungsknopf heißt „jetzt kündigen“ oder entsprechend
 *      eindeutig (Abs. 2 Satz 4).
 *   3. Beides ist ständig verfügbar sowie unmittelbar und leicht zugänglich
 *      (Abs. 2 Satz 2) — deshalb OHNE Anmeldung und aus der Fußzeile jeder
 *      Seite erreichbar. Eine Kündigung hinter dem Login hinge am Passwort.
 *
 * Angaben, die das Gesetz vorsieht (Abs. 2 Satz 3 Nr. 1–5): Art der Kündigung,
 * Bezeichnung des Vertrags, Bezeichnung der Person, Zeitpunkt der Beendigung
 * und ein Weg für die Bestätigung in Textform.
 */
export default async function KuendigenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  // Nur wegportal24: Auf der B&W-Tür ist der Kunde Unternehmer, dort greift
  // § 312k nicht — und es gibt keine Online-Registrierung.
  if (!isWegSaas()) notFound();

  const sp = await searchParams;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="wp-brand rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
        <PublicBrand />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Verträge hier kündigen</h1>
        <p className="mb-6 text-sm text-gray-600">
          Hier können Sie Ihren Vertrag über wegportal24 kündigen — ohne Anmeldung. Sie
          erhalten den Zugang Ihrer Kündigung unverzüglich per E-Mail bestätigt.
        </p>

        {sp.fehler ? (
          <Alert variant="error" className="mb-4">
            {sp.fehler === "limit"
              ? "Es sind zu viele Erklärungen von diesem Anschluss eingegangen. Bitte versuchen Sie es später erneut oder schreiben Sie an info@wegportal24.de — eine Kündigung per E-Mail ist genauso wirksam."
              : "Bitte prüfen Sie Ihre Angaben. Gemeinschaft, Name und eine gültige E-Mail-Adresse werden benötigt."}
          </Alert>
        ) : null}

        <form action={erklaereKuendigung} className="grid gap-4">
          <SelectField label="Art der Kündigung" name="art" required defaultValue="ordentlich">
            <option value="ordentlich">Ordentliche Kündigung</option>
            <option value="ausserordentlich">
              Außerordentliche Kündigung aus wichtigem Grund
            </option>
          </SelectField>

          <Field label="Gemeinschaft / Kunde">
            <input
              name="gemeinschaft"
              type="text"
              required
              className={inputClass}
              placeholder="z. B. WEG Lindenhof 12"
            />
          </Field>

          <Field label="Ihr Name">
            <input name="name" type="text" required className={inputClass} />
          </Field>

          <Field label="Ihre E-Mail-Adresse">
            <input name="email" type="email" required className={inputClass} />
            <p className="mt-1 text-xs text-gray-500">
              An diese Adresse geht die Bestätigung. Am besten die Adresse, mit der Sie sich
              registriert haben.
            </p>
          </Field>

          <Field label="Kunden- oder Vertragsnummer (optional)">
            <input name="kundennummer" type="text" className={inputClass} />
          </Field>

          <Field label="Gewünschter Beendigungszeitpunkt (optional)">
            <input
              name="zeitpunkt"
              type="text"
              className={inputClass}
              placeholder="z. B. zum nächstmöglichen Zeitpunkt"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ohne Angabe kündigen wir zum nächstmöglichen Zeitpunkt — nach den AGB zum Ende
              des laufenden Abrechnungsmonats.
            </p>
          </Field>

          <Field label="Grund (nur bei außerordentlicher Kündigung nötig)">
            <textarea name="grund" rows={3} className={inputClass} />
          </Field>

          {/* § 312k Abs. 2 Satz 4 BGB: Die Bestätigungsschaltfläche trägt die
              Beschriftung „jetzt kündigen“ oder eine entsprechend eindeutige
              Formulierung. Nichts anderes hier hineinschreiben. */}
          <div className="mt-2">
            <SubmitButton pendingLabel="Wird gesendet…">Jetzt kündigen</SubmitButton>
          </div>
        </form>

        <p className="mt-6 text-xs text-gray-500">
          Eine Kündigung ist auch formlos per E-Mail an{" "}
          <a href="mailto:info@wegportal24.de" className="text-brand-green hover:underline">
            info@wegportal24.de
          </a>{" "}
          möglich. Ihr Zugang bleibt bis zur Beendigung unverändert nutzbar; Ihre Daten
          können Sie danach noch mindestens 30 Tage lang exportieren.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/agb" className="text-brand-green hover:underline">
            AGB
          </Link>
          <Link href="/widerruf" className="text-brand-green hover:underline">
            Widerrufsbelehrung
          </Link>
          <Link href="/impressum" className="text-brand-green hover:underline">
            Impressum
          </Link>
        </div>
      </div>
    </main>
  );
}
