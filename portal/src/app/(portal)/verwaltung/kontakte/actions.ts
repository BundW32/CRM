"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canVerwalterManageUser,
  canVerwalterUseCraftsman,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

export type ContactPerson = {
  id: string;
  name: string;
  role: "MIETER" | "EIGENTUEMER";
  email: string | null;
  phone: string | null;
  preferredContact: string | null;
};

const CONTACT_PERSON_LIMIT = 50;

/**
 * Sucht Mieter/Eigentümer im Scope des Verwalters **serverseitig** und gedeckelt
 * – statt alle (potenziell zehntausende) Personen ins Kontaktbuch zu laden.
 * Ohne Suchbegriff werden die ersten Treffer geliefert.
 */
export async function searchContactPersons(query: string): Promise<ContactPerson[]> {
  const verwalter = await requireVerwalter();
  const q = query.trim();
  const persons = await db.user.findMany({
    where: {
      AND: [
        { role: { in: ["MIETER", "EIGENTUEMER"] } },
        ...(q
          ? [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                  { phone: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
        await userWhereForVerwalter(verwalter),
      ],
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: CONTACT_PERSON_LIMIT,
    select: { id: true, name: true, role: true, email: true, phone: true, preferredContact: true },
  });
  return persons.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role as "MIETER" | "EIGENTUEMER",
    email: p.email,
    phone: p.phone,
    preferredContact: p.preferredContact ?? null,
  }));
}

const TRADES = [
  "SANITAER", "HEIZUNG", "ELEKTRO", "DACH", "MALER", "BODENLEGER",
  "FENSTER_TUEREN", "SCHLOSSEREI", "GARTEN", "REINIGUNG",
  "SCHAEDLINGSBEKAEMPFUNG", "AUFZUG", "ALLGEMEIN", "SONSTIGES",
] as const;

const CONTACT_METHODS = ["EMAIL", "TELEFON", "MOBIL", "POST"] as const;

const craftsmanSchema = z.object({
  company: z.string().trim().max(200).optional(),
  name: z.string().trim().min(2).max(200),
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
  redirect("/verwaltung/kontakte?angelegt=1");
}

export async function toggleCraftsmanActive(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  // Scope-/Org-Prüfung: nur Handwerker der eigenen Org (und ggf. zugewiesene).
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect("/verwaltung/kontakte");
  const c = await db.craftsman.findUnique({ where: { id } });
  if (c) {
    await db.craftsman.update({ where: { id }, data: { active: !c.active } });
  }
  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte");
}

export async function toggleCraftsmanInternal(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect("/verwaltung/kontakte");
  const c = await db.craftsman.findUnique({ where: { id } });
  if (c) {
    await db.craftsman.update({ where: { id }, data: { isInternal: !c.isInternal } });
  }
  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte");
}

export async function deleteCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect("/verwaltung/kontakte");
  // Nur löschen, wenn keine Vorgänge zugeordnet sind – sonst nur deaktivieren
  const ticketCount = await db.ticket.count({ where: { craftsmanId: id } });
  if (ticketCount > 0) {
    await db.craftsman.update({ where: { id }, data: { active: false } });
  } else if (id) {
    await db.craftsman.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte");
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
    redirect("/verwaltung/kontakte");
  }

  const parsed = personSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/kontakte?fehler=eingabe");
  }
  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;

  // E-Mail-Eindeutigkeit: nicht die Adresse einer anderen Person übernehmen.
  if (email) {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== id) {
      redirect("/verwaltung/kontakte?fehler=email");
    }
  }

  await db.user.update({
    where: { id },
    data: { name: parsed.data.name, email, phone: parsed.data.phone || null, preferredContact },
  });
  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte");
}

export async function updateCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  // Scope-/Org-Prüfung: nur Handwerker der eigenen Org (und ggf. zugewiesene).
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id))) redirect("/verwaltung/kontakte");

  const parsed = craftsmanSchema.safeParse({
    company: formData.get("company") || undefined,
    name: formData.get("name"),
    trade: formData.get("trade"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    preferredContact: formData.get("preferredContact") || "TELEFON",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/kontakte?fehler=eingabe");
  }

  await db.craftsman.update({
    where: { id },
    data: {
      company: parsed.data.company || null,
      name: parsed.data.name,
      trade: parsed.data.trade,
      email: parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null,
      phone: parsed.data.phone || null,
      preferredContact: parsed.data.preferredContact,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath("/verwaltung/kontakte");
  redirect("/verwaltung/kontakte");
}
