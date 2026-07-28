// Entscheidet, ob die geführte Einrichtung läuft — und lädt sie erst dann.
//
// Serverseitig, damit die Tour-Mechanik für alle, die sie schon kennen, gar
// nicht erst ausgeliefert wird. Ein Overlay, das jeder Aufruf mitlädt, um dann
// festzustellen, dass es nichts zu tun gibt, kostet jeden Seitenwechsel etwas.
//
// **Sie erscheint genau einmal von selbst.** `User.tourDoneAt` merkt sich das —
// auch beim Überspringen. Wer sie wiedersehen will, startet sie unter „Konto"
// neu; ungefragt kommt sie nicht zurück.
import { canUseAssistant, isAssistantEnabled } from "@/lib/assistant";
import { getOrganization, getUser } from "@/lib/session";
import { tourSchritteFuer } from "@/lib/tour";
import { Tour } from "@/components/tour";
import { tourBeenden } from "@/app/(portal)/konto/tour-actions";

export async function TourHost() {
  const user = await getUser();
  if (!user || user.tourDoneAt) return null;

  const org = await getOrganization();
  const schritte = tourSchritteFuer({
    selbstverwaltung: org?.accountType === "selbstverwalter",
    // Der Assistent ist abschaltbar (kein API-Schlüssel = kein Widget). Ohne
    // diese Prüfung verspräche die Führung etwas, das der Nutzer danach
    // vergeblich sucht.
    mitAssistent: isAssistantEnabled() && canUseAssistant(user),
  });
  if (schritte.length === 0) return null;

  return <Tour schritte={schritte} beenden={tourBeenden} />;
}
