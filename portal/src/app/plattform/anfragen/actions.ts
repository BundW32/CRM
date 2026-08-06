"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";

function backTo(id: string, suffix = ""): string {
  return `/plattform/anfragen/${id}${suffix}`;
}

// Antwort des zertifizierten Verwalters. Nur Plattform-Betreiber — der Guard
// steht in JEDER Action, das Layout allein gated keine Server-Actions.
export async function antwortSenden(formData: FormData) {
  const admin = await requirePlatformAdmin();

  const anfrageId = String(formData.get("anfrageId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const anfrage = await db.verwalterAnfrage.findUnique({
    where: { id: anfrageId },
    select: { id: true },
  });
  if (!anfrage) redirect("/plattform/anfragen");
  if (body.length < 2) redirect(backTo(anfrageId, "?fehler=eingabe"));

  await db.verwalterAnfrage.update({
    where: { id: anfrageId },
    data: {
      status: "BEANTWORTET",
      nachrichten: { create: { body, vomBetreiber: true, authorId: admin.id } },
    },
  });
  // Kein Flash: Der Plattform-Bereich hat keinen ToastHost — die Antwort
  // erscheint unmittelbar im Verlauf, das ist die Rückmeldung.
  redirect(backTo(anfrageId));
}

export async function anfrageSchliessenPlattform(formData: FormData) {
  await requirePlatformAdmin();

  const anfrageId = String(formData.get("anfrageId") ?? "");
  const anfrage = await db.verwalterAnfrage.findUnique({
    where: { id: anfrageId },
    select: { id: true },
  });
  if (!anfrage) redirect("/plattform/anfragen");

  await db.verwalterAnfrage.update({
    where: { id: anfrageId },
    data: { status: "GESCHLOSSEN" },
  });
  redirect("/plattform/anfragen");
}
