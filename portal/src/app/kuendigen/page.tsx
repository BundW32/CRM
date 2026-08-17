import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBrand } from "@/components/public-brand";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, inputClass } from "@/components/ui";
import { SelectField } from "@/components/fields";
import { isWegSaas } from "@/lib/app-mode";
import { erklaereKuendigung } from "./actions";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Vertrag kündigen – Kündigungsformular",
    description:
      "Kündigen Sie Ihren Tarif direkt online nach § 312k BGB: Formular ausfüllen, " +
      "absenden, Bestätigung erhalten – ohne Anmeldung möglich.",
  };
}

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
          Verträge über wegportal24 können Sie hier kündigen — ohne Anmeldung. Sie
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

        {/* Erklärender Teil unter dem Formular: Die Schaltfläche nach § 312k
            BGB bleibt das Erste auf der Seite; die Absätze beantworten die
            Fragen, die vor einer Kündigung tatsächlich gestellt werden. */}
        <div className="mt-8 space-y-4 border-t border-gray-200 pt-6 text-sm text-gray-700">
          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">So läuft Ihre Kündigung ab</h2>
            <p>
              Sie füllen das Kündigungsformular aus und senden es ab — eine
              Anmeldung ist nicht nötig. Pflichtangaben sind nur die Art der
              Kündigung, der Name Ihrer Gemeinschaft, Ihr Name und Ihre
              E-Mail-Adresse; alles Weitere ist freiwillig und hilft bei der
              Zuordnung. Den Eingang bestätigen wir Ihnen unverzüglich in
              Textform an die angegebene E-Mail-Adresse, zusammen mit dem
              Zeitpunkt, zu dem der Vertrag endet.
            </p>
            <p>
              Eine Mindestlaufzeit gibt es nicht: Wer seinen Vertrag kündigen
              möchte, kann das jederzeit zum Ende des laufenden
              Abrechnungsmonats tun (Ziffer 8 der{" "}
              <Link href="/agb" className="text-brand-green hover:underline">
                AGB
              </Link>
              ). Bis dahin bleibt das Portal für Ihre Gemeinschaft unverändert
              nutzbar.
            </p>
            <p>
              Ihre Daten gehören Ihrer Gemeinschaft: Journal und Kontoblatt
              lassen sich als CSV exportieren, Beschluss-Sammlung und
              Abrechnungen bleiben bis zum Schluss einsehbar — und auch nach
              der Beendigung noch mindestens 30 Tage lang. Was mit den Daten
              danach geschieht, steht in der{" "}
              <Link href="/datenschutz" className="text-brand-green hover:underline">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">Kündigung oder Widerruf?</h2>
            <p>
              Liegt Ihr Vertragsabschluss weniger als 14 Tage zurück, können
              Sie den Vertrag statt der Kündigung auch widerrufen — Frist,
              Form und Folgen stehen in der{" "}
              <Link href="/widerruf" className="text-brand-green hover:underline">
                Widerrufsbelehrung
              </Link>
              . Im kostenlosen Start-Tarif fallen ohnehin keine Kosten an; ein
              Konto ohne Bezahltarif können Sie ebenfalls über dieses
              Formular beenden.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">
              Wer erklärt die Kündigung für eine Gemeinschaft?
            </h2>
            <p>
              Vertragspartnerin ist Ihre Wohnungseigentümergemeinschaft.
              Erklären sollte die Kündigung deshalb die Person, die die
              Gemeinschaft vertritt — in der Selbstverwaltung ist das der zum
              Verwalter bestellte Miteigentümer. Tragen Sie im Formular den
              Namen der Gemeinschaft so ein, wie er im Portal angelegt ist;
              das erspart Rückfragen bei der Zuordnung.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">Brauchen wir einen Grund?</h2>
            <p>
              Für die ordentliche Kündigung nicht — sie ist jederzeit und ohne
              Begründung möglich. Nur die außerordentliche Kündigung aus
              wichtigem Grund setzt voraus, dass Sie den Grund benennen; dafür
              gibt es das Feld am Ende des Formulars. Und ein Wechsel des
              Tarifs ist keine Kündigung: Zwischen den Stufen wechseln Sie
              jederzeit im Portal, die Daten bleiben vollständig erhalten.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold text-gray-900">Was gilt bis zum Vertragsende?</h2>
            <p>
              Bis zum Ende des laufenden Abrechnungsmonats bleibt das Portal
              für Ihre Gemeinschaft voll nutzbar und wird wie vereinbart
              berechnet; danach endet die Berechnung. Beide Seiten können nach
              den AGB jederzeit so kündigen — es gibt keine Frist, die Sie
              versäumen könnten. Die Bestätigung mit dem Zeitpunkt der
              Beendigung bleibt in Ihrem E-Mail-Postfach dokumentiert; mehr
              müssen Sie nicht veranlassen. Möchte Ihre Gemeinschaft später
              zurückkehren, steht einer neuen Registrierung nichts im Wege.
            </p>
          </section>
        </div>

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
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutz
          </Link>
          <Link href="/login" className="text-brand-green hover:underline">
            Zur Anmeldung
          </Link>
        </div>
      </div>
    </main>
  );
}
