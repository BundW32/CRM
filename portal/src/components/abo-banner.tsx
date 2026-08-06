import Link from "next/link";
import type { AboHinweis } from "@/lib/billing";

// Schmales Band über dem Inhalt, wenn der Abo-Zustand Aufmerksamkeit braucht.
// Was die Zustände BEDEUTEN (past_due = Kulanz, canceled/Testphase abgelaufen =
// Start-Umfang), steht bei `aboHinweis` in lib/billing.ts — hier steht nur, wie
// man es sagt. Nur für die verwaltende Person: Eigentümer und Mieter können
// nichts daran ändern und müssten die Meldung jeden Tag wegsehen.
const TEXTE: Record<AboHinweis, { text: string; aktion: string; kritisch: boolean }> = {
  "testphase-abgelaufen": {
    text:
      "Ihre Testphase ist beendet — es gilt jetzt der Start-Umfang (einrichten und ansehen). " +
      "Ihre Daten bleiben vollständig erhalten.",
    aktion: "Tarif wählen",
    kritisch: false,
  },
  "zahlung-ueberfaellig": {
    text:
      "Die letzte Zahlung ist fehlgeschlagen. Alle Funktionen bleiben vorerst nutzbar — " +
      "bitte aktualisieren Sie Ihr Zahlungsmittel, sonst endet das Abo.",
    aktion: "Abo verwalten",
    kritisch: true,
  },
  gekuendigt: {
    text:
      "Ihr Abo ist beendet — es gilt der Start-Umfang (einrichten und ansehen). " +
      "Ihre Daten bleiben vollständig erhalten; Sie können jederzeit neu buchen.",
    aktion: "Tarif wählen",
    kritisch: false,
  },
};

export function AboBanner({
  hinweis,
  kannBuchen,
}: {
  hinweis: AboHinweis;
  /** Nur SuperAdmins sehen den Abrechnungs-Link — für alle anderen wäre er eine Sackgasse. */
  kannBuchen: boolean;
}) {
  const t = TEXTE[hinweis];
  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-sm ${
        t.kritisch
          ? "border-critical/30 bg-critical-light text-critical"
          : "border-warn/30 bg-warn-light text-warn"
      }`}
    >
      <span className="min-w-0 flex-1">{t.text}</span>
      {kannBuchen ? (
        <Link href="/verwaltung/abrechnung" className="shrink-0 font-semibold underline">
          {t.aktion}
        </Link>
      ) : (
        <span className="shrink-0">Ein Administrator Ihrer Gemeinschaft kann das übernehmen.</span>
      )}
    </div>
  );
}
