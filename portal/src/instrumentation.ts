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

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { meldeServerFehler } = await import("@/lib/fehler-alarm");
  await meldeServerFehler(err, request, context);
};
