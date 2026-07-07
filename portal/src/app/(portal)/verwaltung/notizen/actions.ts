"use server";
import { revalidatePath } from "next/cache";
import {
  canVerwalterAccessNote,
  canVerwalterAccessProperty,
  canVerwalterManageUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export type NoteTargets = {
  units: { id: string; label: string }[];
  persons: { id: string; name: string; roleLabel: string }[];
};

/**
 * Lädt Einheiten und zugehörige Personen (Mieter/Eigentümer) eines Objekts
 * **on demand** – im Scope des Verwalters. So muss das Notiz-Formular nicht alle
 * Einheiten und alle Personen des Bestands ins HTML serialisieren.
 */
export async function loadNoteTargets(propertyId: string): Promise<NoteTargets> {
  const user = await requireUser();
  if (user.role !== "VERWALTER" || !propertyId) return { units: [], persons: [] };
  // Org- und Zuweisungsprüfung (verhindert Cross-Org-Lesen der Einheiten/Personen).
  if (!(await canVerwalterAccessProperty(user, propertyId))) return { units: [], persons: [] };

  const [units, owners, tenants] = await Promise.all([
    db.unit.findMany({
      where: { propertyId },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
    db.user.findMany({
      where: { role: "EIGENTUEMER", active: true, ownerships: { some: { propertyId } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where: {
        role: "MIETER",
        active: true,
        tenancies: { some: { active: true, unit: { propertyId } } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    units,
    persons: [
      ...owners.map((o) => ({ id: o.id, name: o.name, roleLabel: roleLabels.EIGENTUEMER })),
      ...tenants.map((t) => ({ id: t.id, name: t.name, roleLabel: roleLabels.MIETER })),
    ],
  };
}

export async function createNote(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  if (!body) return;
  const propertyId = (formData.get("propertyId") as string | null) || undefined;
  const unitId = (formData.get("unitId") as string | null) || undefined;
  const targetUserId = (formData.get("targetUserId") as string | null) || undefined;

  // Konsistenz erzwingen: gehört eine Einheit dazu, leitet sich das Objekt aus der
  // Einheit ab – so kann kein widersprüchliches Objekt/Einheit-Paar gespeichert werden.
  let resolvedPropertyId = propertyId || null;
  if (unitId) {
    const unit = await db.unit.findUnique({ where: { id: unitId }, select: { propertyId: true } });
    resolvedPropertyId = unit?.propertyId ?? resolvedPropertyId;
  }

  // Scope-Prüfung (org-bewusst, gilt auch für SuperAdmin): nur eigene Objekte/Personen.
  if (resolvedPropertyId && !(await canVerwalterAccessProperty(user, resolvedPropertyId))) return;
  if (targetUserId && !(await canVerwalterManageUser(user, targetUserId))) return;

  await db.note.create({
    data: {
      body,
      authorId: user.id,
      organizationId: user.organizationId,
      propertyId: resolvedPropertyId,
      unitId: unitId || null,
      targetUserId: targetUserId || null,
    },
  });
  revalidatePath("/verwaltung/notizen");
}

export async function deleteNote(id: string) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  // IDOR-Schutz: nur Notizen im eigenen Scope dürfen gelöscht werden.
  if (!(await canVerwalterAccessNote(user, id))) return;
  await db.note.delete({ where: { id } });
  revalidatePath("/verwaltung/notizen");
}

export async function togglePinNote(id: string, pinned: boolean) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  // IDOR-Schutz: nur Notizen im eigenen Scope dürfen angepinnt werden.
  if (!(await canVerwalterAccessNote(user, id))) return;
  await db.note.update({ where: { id }, data: { pinned: !pinned } });
  revalidatePath("/verwaltung/notizen");
}
