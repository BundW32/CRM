"use server";

import { redirect } from "next/navigation";
import { canVerwalterAccessAnfrage } from "@/lib/access";
import { hatPlanFunktion } from "@/lib/billing";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

function backTo(suffix = ""): string {
  return `/verwaltung/verwalter-tickets${suffix}`;
}

// Plan-Wächter für alles, was eine NEUE Nachricht an den zertifizierten
// Verwalter erzeugt: Das Ticket-System ist das Unterscheidungsmerkmal von
// Verwalter-Plus. Die Sperre steht serverseitig — ein ausgeblendetes Formular
// allein wäre keine (siehe Versammlungsbeschluss-Sperre). Lesen und Schließen
// bleiben auch nach einem Wechsel zurück auf Basic möglich: Die bereits
// bezahlten Antworten gehören der Gemeinschaft.
async function requireVerwalterTicketPlan() {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();
  if (!org || !hatPlanFunktion(org, "verwalterTicket")) {
    redirect(backTo("?flash=nur-verwalter-plus"));
  }
  return verwalter;
}

export async function anfrageErstellen(formData: FormData) {
  const verwalter = await requireVerwalterTicketPlan();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title.length < 3 || body.length < 10) redirect(backTo("/neu?fehler=eingabe"));

  const anfrage = await db.verwalterAnfrage.create({
    data: {
      organizationId: verwalter.organizationId,
      title,
      createdById: verwalter.id,
      nachrichten: { create: { body, authorId: verwalter.id } },
    },
  });
  redirect(backTo(`/${anfrage.id}?flash=anfrage-gesendet`));
}

export async function rueckfrageSenden(formData: FormData) {
  const verwalter = await requireVerwalterTicketPlan();

  const anfrageId = String(formData.get("anfrageId") ?? "");
  if (!(await canVerwalterAccessAnfrage(verwalter, anfrageId))) {
    redirect(backTo("?flash=keine-berechtigung"));
  }
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) redirect(backTo(`/${anfrageId}?fehler=eingabe`));

  await db.verwalterAnfrage.update({
    where: { id: anfrageId },
    data: {
      // Eine Rückfrage legt die Anfrage wieder dem Betreiber vor.
      status: "OFFEN",
      nachrichten: { create: { body, authorId: verwalter.id } },
    },
  });
  redirect(backTo(`/${anfrageId}?flash=gesendet`));
}

export async function anfrageSchliessen(formData: FormData) {
  // Bewusst KEIN Plan-Wächter: Schließen erzeugt keine Leistung des
  // Betreibers, es räumt nur die eigene Liste auf.
  const verwalter = await requireVerwalter();

  const anfrageId = String(formData.get("anfrageId") ?? "");
  if (!(await canVerwalterAccessAnfrage(verwalter, anfrageId))) {
    redirect(backTo("?flash=keine-berechtigung"));
  }
  await db.verwalterAnfrage.update({
    where: { id: anfrageId },
    data: { status: "GESCHLOSSEN" },
  });
  redirect(backTo("?flash=aktualisiert"));
}
