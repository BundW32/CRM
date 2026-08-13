// Beobachtbarkeit (Audit B-4): Next ruft `onRequestError` bei jedem
// unbehandelten Serverfehler auf — Server-Komponenten, Route-Handler und
// Server-Actions gleichermaßen. Von hier geht der Alarm an den Betreiber
// (lib/fehler-alarm.ts, mit Drossel), damit Fehler auffallen, BEVOR ein Kunde
// sie meldet.
//
// Der Import passiert erst im Fehlerfall und nur in der Node-Laufzeit:
// nodemailer und Prisma haben in der Edge-Laufzeit nichts verloren, und beim
// Serverstart muss dieses Modul nichts laden.
import type { Instrumentation } from "next";

/**
 * Läuft einmal beim Start des Servers, vor der ersten Anfrage.
 *
 * Hier wird geprüft, ob die Dateiablage in Produktion überhaupt eingerichtet
 * ist. Ohne diese Prüfung fällt eine fehlende `BLOB_READ_WRITE_TOKEN` erst auf,
 * wenn ein Kunde seinen ersten Beleg hochlädt oder einen Wirtschaftsplan
 * beschließt — und dann ist der Beschluss gefasst und die Dokumente fehlen.
 * Genau so ist es passiert.
 *
 * `console.error` und nicht der E-Mail-Alarm: Der Start ist der falsche Moment
 * für einen Mailversand (Cold Start, unvollständige Umgebung), und die Meldung
 * steht so in jedem Vercel-Log der Bereitstellung. Wer genauer messen will,
 * öffnet die Selbstprüfung unter /verwaltung/ablage.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warnungAblageKonfiguration } = await import("@/lib/ablage-check");
  const warnung = warnungAblageKonfiguration(process.env);
  if (warnung) console.error(warnung);
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { meldeServerFehler } = await import("@/lib/fehler-alarm");
  await meldeServerFehler(err, request, context);
};
