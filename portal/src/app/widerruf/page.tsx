import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { isWegSaas, productName } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Widerrufsbelehrung und Muster-Formular",
    description:
      "Ihr Widerrufsrecht als Gemeinschaft: Frist, Form, Folgen des Widerrufs " +
      "und das Muster-Widerrufsformular zum Ausfüllen.",
  };
}

/**
 * Widerrufsbelehrung nach Art. 246a § 1 Abs. 2 EGBGB, samt Muster-
 * Widerrufsformular (Anlage 2 zu Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB).
 *
 * Nur auf wegportal24: Dort ist die Kundin eine selbstverwaltende WEG und
 * damit Verbraucherin (BGH VIII ZR 243/13). Auf der B&W-Tür ist der Kunde
 * Unternehmer — dort gibt es kein Widerrufsrecht, und eine Belehrung, die
 * eines verspricht, wäre eine unnötige Selbstbindung.
 *
 * Die Belehrung ist kein Beiwerk: Ohne ordnungsgemäße Belehrung erlischt das
 * Widerrufsrecht erst zwölf Monate und 14 Tage nach Fristbeginn
 * (§ 356 Abs. 3 Satz 2 BGB). Ein Jahr lang widerrufbare Verträge sind teurer
 * als jede Belehrung.
 */
export default function WiderrufPage() {
  // Auf der B&W-Tür gibt es diese Seite nicht — der Kunde ist dort Unternehmer.
  if (!isWegSaas()) notFound();

  return (
    <LegalPage
      title="Widerrufsbelehrung"
      intro={
        <p>
          Diese Widerrufsbelehrung gilt für Verbraucherinnen und Verbraucher im Sinne des
          § 13 BGB.
          Eine Wohnungseigentümergemeinschaft ist als Verbraucherin anzusehen, wenn ihr
          mindestens eine natürliche Person angehört und der Vertrag weder gewerblichen
          noch selbständigen beruflichen Zwecken dient (BGH, Urteil vom 25. März 2015 –
          VIII ZR 243/13). Sie ist Bestandteil der{" "}
          <Link href="/agb" className="text-brand-green hover:underline">
            AGB
          </Link>{" "}
          von {productName()}.
        </p>
      }
    >
      <LegalSection title="Widerrufsrecht">
        <p>
          Sie haben das Recht, binnen <strong>vierzehn Tagen</strong> ohne Angabe von
          Gründen diesen Vertrag zu widerrufen.
        </p>
        <p>
          Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
        </p>
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          B &amp; W Immobilien Management UG (haftungsbeschränkt)
          <br />
          Goethestraße 42
          <br />
          45964 Gladbeck
          <br />
          Deutschland
          <br />
          E-Mail:{" "}
          <a href="mailto:info@bundwimmobilien.de" className="text-brand-green hover:underline">
            info@bundwimmobilien.de
          </a>
          <br />
          Telefon: +49 151 29468127
        </p>
        <p>
          mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder
          eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.
          Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch
          nicht vorgeschrieben ist.
        </p>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die
          Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
        </p>
      </LegalSection>

      <LegalSection title="Folgen des Widerrufs">
        <p>
          Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von
          Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der
          zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der
          Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt
          haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
          zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns
          eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das
          Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen
          wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen
          dieser Rückzahlung Entgelte berechnet.
        </p>
        <p>
          Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen
          soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der
          bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts
          hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im
          Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen
          entspricht.
        </p>
        <p className="text-gray-500">
          Hinweis: Solange Sie sich in der kostenlosen Testphase befinden, haben Sie keine
          Zahlungen geleistet — ein Widerruf ist dann für Sie in jedem Fall kostenfrei.
        </p>
      </LegalSection>

      <LegalSection title="Muster-Widerrufsformular">
        <p className="text-gray-500">
          (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular
          aus und senden Sie es zurück.)
        </p>
        <div className="whitespace-pre-line rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs leading-relaxed text-gray-800">
{`An:
B & W Immobilien Management UG (haftungsbeschränkt)
Goethestraße 42
45964 Gladbeck
E-Mail: info@bundwimmobilien.de

Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen
Vertrag über die Erbringung der folgenden Dienstleistung (*):

    ____________________________________________

Bestellt am (*) / erhalten am (*):  __________________

Name der/des Verbraucher(s):        __________________

Anschrift der/des Verbraucher(s):   __________________

    ____________________________________________

Unterschrift der/des Verbraucher(s)
(nur bei Mitteilung auf Papier)

Datum: __________________

(*) Unzutreffendes streichen.`}
        </div>
      </LegalSection>
    </LegalPage>
  );
}
