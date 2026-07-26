"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterManageUser, canVerwalterUseCraftsman } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

// Rücksprung: `updatePersonContact` läuft aus der Adressbuch-Zeile UND von der
// Kontakt-Detailseite. Der Pfad wird gegen ein festes Muster geprüft, damit über
// ein untergeschobenes Feld keine Weiterleitung auf fremde Adressen möglich ist.
const ZURUECK_ERLAUBT = /^\/verwaltung\/kontakte(\/[A-Za-z0-9_-]+)?$/;

function zurueckZu(formData: FormData, suffix = ""): string {
  const raw = String(formData.get("zurueck") ?? "").trim();
  const base = ZURUECK_ERLAUBT.test(raw) ? raw : "/verwaltung/kontakte";
  return base + suffix;
}

const TRADES = [
  "SANITAER", "HEIZUNG", "ELEKTRO", "DACH", "MALER", "BODENLEGER",
  "FENSTER_TUEREN", "SCHLOSSEREI", "GARTEN", "REINIGUNG",
  "SCHAEDLINGSBEKAEMPFUNG", "AUFZUG", "ALLGEMEIN", "SONSTIGES",
] as const;

const CONTACT_METHODS = ["EMAIL", "TELEFON", "MOBIL", "POST"] as const;

const CONTACT_KINDS = [
  "HANDWERKER",
  "DIENSTLEISTER",
  "VERSORGER",
  "BEHOERDE",
  "SONSTIGES",
] as const;

const craftsmanSchema = z.object({
  company: z.string().trim().max(200).optional(),
  name: z.string().trim().min(2).max(200),
  // Art des Eintrags; ohne Angabe bleibt es beim historischen Fall Handwerker.
  kind: z.enum(CONTACT_KINDS).default("HANDWERKER"),
  trade: z.enum(TRADES),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  preferredContact: z.enum(CONTACT_METHODS),
  notes: z.string().trim().max(2000).optional(),
});

export async function createCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = craftsmanSchema.safeParse({
    company: formData.get("company") || undefined,
    name: formData.get("name"),
    kind: formData.get("kind") || "HANDWERKER",
    trade: formData.get("trade"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    preferredContact: formData.get("preferredContact") || "TELEFON",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/kontakte?fehler=eingabe");
  }

  await db.craftsman.create({
    data: {
      company: parsed.data.company || null,
      name: parsed.data.name,
      kind: parsed.data.kind,
      trade: parsed.data.trade,
      email: parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null,
      phone: parsed.data.phone || null,
      preferredContact: parsed.data.preferredContact,
      notes: parsed.data.notes || null,
      // Interner Handwerker (Eigenleistung)
      isInternal: formData.get("isInternal") === "on",
      // Magic-Link-Token für das Auftragsportal
      accessToken: crypto.randomBytes(24).toString("hex"),
      organizationId: verwalter.organizationId,
    },
  });

  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte?flash=kontakt-angelegt");
}

export async function toggleCraftsmanActive(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  // Scope-/Org-Prüfung: nur Handwerker der eigenen Org (und ggf. zugewiesene).
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect(zurueckZu(formData));
  const c = await db.craftsman.findUnique({ where: { id } });
  if (c) {
    await db.craftsman.update({ where: { id }, data: { active: !c.active } });
  }
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=gespeichert"));
}

export async function toggleCraftsmanInternal(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect(zurueckZu(formData));
  const c = await db.craftsman.findUnique({ where: { id } });
  if (c) {
    await db.craftsman.update({ where: { id }, data: { isInternal: !c.isInternal } });
  }
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=gespeichert"));
}

export async function deleteCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect(zurueckZu(formData));
  // Nur löschen, wenn keine Vorgänge zugeordnet sind – sonst nur deaktivieren
  const ticketCount = await db.ticket.count({ where: { craftsmanId: id } });
  if (ticketCount > 0) {
    await db.craftsman.update({ where: { id }, data: { active: false } });
  } else if (id) {
    await db.craftsman.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=geloescht"));
}

const personSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
});

export async function updatePersonContact(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const pcRaw = String(formData.get("preferredContact") ?? "");
  const preferredContact = (CONTACT_METHODS as readonly string[]).includes(pcRaw)
    ? (pcRaw as (typeof CONTACT_METHODS)[number])
    : null;

  // Scope-Prüfung: nur Personen im eigenen Zuständigkeitsbereich bearbeiten.
  if (!id || !(await canVerwalterManageUser(verwalter, id))) {
    redirect(zurueckZu(formData));
  }

  const parsed = personSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    redirect(zurueckZu(formData, "?fehler=eingabe"));
  }
  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;

  // E-Mail-Eindeutigkeit: nicht die Adresse einer anderen Person übernehmen.
  if (email) {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== id) {
      redirect(zurueckZu(formData, "?fehler=email"));
    }
  }

  await db.user.update({
    where: { id },
    data: { name: parsed.data.name, email, phone: parsed.data.phone || null, preferredContact },
  });
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=kontakt-gespeichert"));
}

export async function updateCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  // Scope-/Org-Prüfung: nur Handwerker der eigenen Org (und ggf. zugewiesene).
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect(zurueckZu(formData));

  const parsed = craftsmanSchema.safeParse({
    company: formData.get("company") || undefined,
    name: formData.get("name"),
    kind: formData.get("kind") || "HANDWERKER",
    trade: formData.get("trade"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    preferredContact: formData.get("preferredContact") || "TELEFON",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    redirect(zurueckZu(formData, "?fehler=eingabe"));
  }

  await db.craftsman.update({
    where: { id },
    data: {
      company: parsed.data.company || null,
      name: parsed.data.name,
      kind: parsed.data.kind,
      trade: parsed.data.trade,
      email: parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null,
      phone: parsed.data.phone || null,
      preferredContact: parsed.data.preferredContact,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=kontakt-gespeichert"));
}
