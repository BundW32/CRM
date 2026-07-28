import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Badge } from "@/components/data-display";
import { PendingButton } from "@/components/pending-button";
import { SignatureCanvas } from "@/app/(portal)/verwaltung/nutzer/signature-canvas";
import { formatDate } from "@/lib/labels";
import { hasCertMandate } from "@/lib/cert-mandate";
import { grantCertMandate, revokeCertMandate, saveOwnSignature } from "./actions";

type EigentuemerFelder = {
  signatureStoredName: string | null;
  signatureSelfSigned: boolean;
  certMandateGrantedAt: Date | null;
  certMandateRevokedAt: Date | null;
  certMandateSource: string | null;
  certMandateNote: string | null;
};

/**
 * Unterschrift und Vollmacht in der Hand des Eigentümers.
 *
 * Bis hierher konnte nur der Verwalter eine Unterschrift hinterlegen – er malte
 * also die Unterschrift des Eigentümers, die anschließend unter dessen Namen auf
 * der Wohnungsgeberbestätigung erschien. Diese Karte dreht das um: Der
 * Eigentümer unterschreibt selbst und erteilt die Vollmacht selbst.
 */
export function VollmachtKarte({ user }: { user: EigentuemerFelder }) {
  const vollmachtAktiv = hasCertMandate(user);
  const eigeneUnterschrift = Boolean(user.signatureStoredName) && user.signatureSelfSigned;

  return (
    <div className="space-y-5">
      <form action={saveOwnSignature} className="space-y-3">
        <p className="text-sm text-gray-600">
          Ihre Unterschrift wird für Bescheinigungen verwendet, die die Verwaltung für
          Ihre vermieteten Einheiten ausstellt – etwa die Wohnungsgeberbestätigung, die
          Ihr Mieter beim Einwohnermeldeamt vorlegen muss.
        </p>
        {eigeneUnterschrift ? (
          <p className="text-xs text-green-700">
            Ihre eigene Unterschrift ist hinterlegt.
          </p>
        ) : user.signatureStoredName ? (
          <p className="text-xs text-amber-700">
            Aktuell ist eine von der Verwaltung erfasste Unterschrift hinterlegt. Bitte
            unterschreiben Sie einmal selbst – erst dann erscheinen Bescheinigungen unter
            Ihrem eigenen Namen statt mit dem Zusatz &bdquo;i.&nbsp;A.&ldquo;.
          </p>
        ) : null}
        <SignatureCanvas hasExisting={eigeneUnterschrift} />
        <PendingButton className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Unterschrift speichern
        </PendingButton>
      </form>

      <div className="border-t border-gray-100 pt-4">
        {vollmachtAktiv ? (
          <>
            <p className="text-sm text-gray-700">
              <Badge tone="success">Vollmacht erteilt</Badge>
              {user.certMandateGrantedAt ? (
                <span className="ml-2 text-xs text-gray-500">
                  am {formatDate(user.certMandateGrantedAt)}
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Die Verwaltung darf Wohnungsgeberbestätigungen und Mietbescheinigungen für
              Ihre <strong>vermieteten</strong> Einheiten in Ihrem Namen ausstellen. Für
              selbst genutzte Einheiten gilt das nicht – dort gibt es nichts zu bescheinigen.
            </p>
            {/* Wurde die Vollmacht auf Papier erteilt, hat die Verwaltung sie hier
                vermerkt. Der Eigentümer muss sehen, was in seinem Namen eingetragen
                wurde – sonst wäre der Vermerk für ihn unsichtbar. */}
            {user.certMandateSource === "SCHRIFTLICH" ? (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Diese Vollmacht hat Ihre Verwaltung anhand Ihrer{" "}
                <strong>schriftlich erteilten</strong> Vollmacht vermerkt.
                {user.certMandateNote ? (
                  <span className="mt-0.5 block text-gray-500">
                    Hinterlegt als: {user.certMandateNote}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-gray-500">
                  Stimmt das nicht? Dann widerrufen Sie sie hier und wenden Sie sich an
                  Ihre Verwaltung.
                </span>
              </p>
            ) : null}
            <form action={revokeCertMandate} className="mt-3">
              <ConfirmActionButton
                className="text-xs text-red-600 hover:underline"
                confirmLabel="Vollmacht wirklich widerrufen?"
                pendingLabel="Wird widerrufen…"
              >
                Vollmacht widerrufen
              </ConfirmActionButton>
            </form>
          </>
        ) : (
          <form action={grantCertMandate} className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" name="zustimmung" required className="mt-1" />
              <span>
                Ich bevollmächtige die Verwaltung, für meine vermieteten Einheiten
                Wohnungsgeberbestätigungen nach § 19 BMG und Mietbescheinigungen in meinem
                Namen zu erstellen und meine hinterlegte Unterschrift dafür zu verwenden.
                Ich kann diese Vollmacht jederzeit hier widerrufen.
              </span>
            </label>
            <PendingButton className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Vollmacht erteilen
            </PendingButton>
          </form>
        )}
      </div>
    </div>
  );
}
