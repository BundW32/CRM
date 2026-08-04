import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import {
  BankImportVisual,
  ReserveVisual,
  StatementVisual,
  UnitPlanVisual,
} from "@/components/marketing/visuals";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WEG-Finanzen: Wirtschaftsplan, Buchhaltung & Jahresabrechnung",
  description:
    "So verwaltet Ihre WEG die Finanzen selbst: Wirtschaftsplan nach § 28 WEG mit " +
    "Assistent, Buchhaltung mit CSV-Bankimport, getrennte Erhaltungsrücklage und " +
    "revisionssichere Jahresabrechnung.",
};

export default async function FinanzenPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/finanzen" />

      <MarketingHero
        eyebrow="WEG-Finanzen"
        title={
          <>
            Vom ersten Hausgeld bis zur{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">fertigen Jahresabrechnung.</span>
          </>
        }
        intro={
          "Die Finanzen sind der Teil der Selbstverwaltung, vor dem die meisten " +
          "Eigentümer Respekt haben – und genau dafür ist dieses Portal gebaut. " +
          "Assistenten führen durch Wirtschaftsplan, Buchhaltung und " +
          "Jahresabrechnung, rechnen centgenau und prüfen, ob am Ende alles aufgeht."
        }
        image={{
          src: "/images/marketing/finanzen.jpg",
          alt: "Eigentümer plant den Wirtschaftsplan am Laptop",
        }}
        badge={{ icon: <CalendarCheck className="h-4 w-4 text-wp-accent-ink" />, text: "Wirtschaftsplan & Jahresabrechnung centgenau" }}
      />

      <FeatureSection
        id="wirtschaftsplan"
        eyebrow="§ 28 Abs. 1 WEG"
        title="Wirtschaftsplan: der Haushaltsplan Ihrer WEG"
        visual={<UnitPlanVisual />}
        points={[
          "Assistent übernimmt die Istwerte des Vorjahres als Vorschlag",
          "Einzelwirtschaftspläne je Einheit nach Umlageschlüsseln (MEA, Fläche, Personen …)",
          "Fertige Beschlussvorlage für die Versammlung",
          "Nach dem Beschluss: 12 monatliche Hausgeld-Sollstellungen je Einheit – centgenau",
        ]}
      >
        <p>
          Jede WEG beschließt jährlich, welche Kosten anfallen und wer wie viel
          Hausgeld zahlt. Im Portal legen Sie die erwarteten Kosten je Kostenart
          fest – auf Wunsch mit den Istwerten des Vorjahres als Startpunkt – und
          das System verteilt sie automatisch nach den Umlageschlüsseln aus Ihrer
          Teilungserklärung auf die Einheiten.
        </p>
        <p>
          Das Ergebnis: ein Gesamtwirtschaftsplan, ein Einzelwirtschaftsplan für
          jeden Eigentümer und eine Beschlussvorlage für die Versammlung. Sobald
          der Beschluss gefasst ist, entstehen daraus automatisch die monatlichen
          Zahlungspflichten – niemand muss Beträge von Hand ausrechnen.
        </p>
      </FeatureSection>

      <FeatureSection
        id="buchhaltung"
        eyebrow="Buchhaltung"
        title="Buchen ohne Buchhalter: CSV-Import vom Bankkonto"
        reverse
        visual={<BankImportVisual />}
        points={[
          "CSV-Export der Bank hochladen (z. B. Sparkasse, Volksbank)",
          "Spalten-Mapping-Assistent erkennt das Format Ihrer Bank",
          "Duplikaterkennung verhindert doppelte Buchungen",
          "Belege (Rechnungen, Quittungen) direkt an die Buchung anhängen",
          "Komplett ohne API-Schlüssel oder Zusatzkosten",
        ]}
      >
        <p>
          Statt jede Zahlung abzutippen, laden Sie einfach den Kontoauszug als
          CSV-Datei aus Ihrem Online-Banking hoch. Das Portal liest die Umsätze
          ein, schlägt anhand des Verwendungszwecks vor, zu welcher Einheit oder
          Kostenart eine Zahlung gehört, und überspringt bereits importierte
          Umsätze automatisch.
        </p>
        <p>
          Einzelne Buchungen – etwa eine Barauslage – erfassen Sie in Sekunden
          von Hand und hängen den Beleg als Foto oder PDF direkt an. So entsteht
          nebenbei eine lückenlose, belegte Buchführung, die auch der Beirat oder
          ein prüfender Eigentümer jederzeit nachvollziehen kann.
        </p>
      </FeatureSection>

      <FeatureSection
        id="ruecklage"
        eyebrow="Erhaltungsrücklage & Sonderumlage"
        title="Die Rücklage bleibt unantastbar – und sichtbar"
        visual={<ReserveVisual />}
        points={[
          "Girokonto und Rücklagenkonto strikt getrennt geführt",
          "Umbuchungen Giro ↔ Rücklage mit einem Klick, sauber dokumentiert",
          "Kontensalden jederzeit für alle berechtigten Eigentümer einsehbar",
          "Erhaltungsplanung: anstehende Maßnahmen mit Kosten und Finanzierungsbedarf",
          "Sonderumlage: nach Beschluss centgenau auf die Einheiten verteilt",
        ]}
      >
        <p>
          Die Erhaltungsrücklage ist das Sparbuch Ihrer WEG für Dach, Heizung und
          größere Reparaturen. Ordnungsmäßige Verwaltung heißt: Sie wird getrennt
          vom laufenden Geld geführt. Das Portal bildet genau das ab – mit
          eigenem Konto, eigenem Saldo und dokumentierten Zuführungen.
        </p>
        <p>
          Jede Umbuchung zwischen Girokonto und Rücklage wird als eigener Vorgang
          festgehalten. So sieht jeder Eigentümer schwarz auf weiß, wie die
          Rücklage wächst – und dass niemand daraus stillschweigend laufende
          Kosten bezahlt.
        </p>
        <p>
          Reicht die Rücklage für eine anstehende Maßnahme nicht, beschließt die
          Gemeinschaft eine Sonderumlage. Das Portal behandelt sie wie einen
          kleinen Wirtschaftsplan: Der Betrag wird nach dem gewählten Schlüssel
          auf die Einheiten verteilt, wird zur Zahlungspflicht je Einheit und
          taucht anschließend in der Rückstandsliste auf wie das Hausgeld.
        </p>
      </FeatureSection>

      <FeatureSection
        id="jahresabrechnung"
        eyebrow="§ 28 Abs. 2 WEG"
        title="Jahresabrechnung, die aufgeht – garantiert geprüft"
        reverse
        visual={<StatementVisual />}
        points={[
          "Harte Kontenprüfung: Endbestand muss zum Kontoauszug passen, sonst keine Fertigstellung",
          "Einzelabrechnungen je Einheit inkl. manueller Heizkosten-Verteilung",
          "Abrechnungsspitze (Nachschuss oder Guthaben) je Eigentümer",
          "§ 35a-Ausweis für die Steuererklärung jedes Eigentümers",
          "Vermögensbericht nach § 28 Abs. 4 WEG",
          "Tagesgenaue Aufteilung bei Eigentümerwechsel im Jahr",
        ]}
      >
        <p>
          Die Jahresabrechnung ist der Punkt, an dem selbstgebaute
          Excel-Lösungen scheitern. Das Portal erstellt die Gesamtabrechnung aus
          Ihren Buchungen und verweigert die Fertigstellung, solange der
          rechnerische Endbestand nicht mit dem echten Kontostand übereinstimmt –
          Fehler fallen also auf, bevor die Abrechnung verschickt wird.
        </p>
        <p>
          Ist alles geprüft, wird das Ergebnis revisionssicher festgeschrieben:
          Die beschlossene Abrechnung bleibt dauerhaft unverändert erhalten, auch
          wenn danach weitergebucht wird. Jeder Eigentümer erhält seine
          Einzelabrechnung mit Abrechnungsspitze und Steuerausweis als PDF.
        </p>
      </FeatureSection>

      <CtaBand
        title="Finanzen geklärt – Zeit, anzufangen"
        text="Richten Sie Ihre WEG kostenlos ein und machen Sie die erste Buchung noch heute."
      />
      <MarketingFooter />
    </main>
  );
}
