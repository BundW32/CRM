"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterManageUser, canVerwalterUseCraftsman } from "@/lib/access";
import { AUDIT, logAudit } from "@/lib/audit";
import { neuesCraftsmanToken } from "@/lib/craftsman-token";
import type { ContactKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { contactKindLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { sonstigesFreitext } from "@/lib/sonstiges";
import { DOCUMENT_TYPES, saveUpload } from "@/lib/storage";
import { ablageFehlerText } from "@/lib/weg/ablage-fehler";

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

// Einzige Quelle der zulässigen Arten ist der Beschriftungs-Katalog: Er ist ein
// `Record<ContactKind, …>` und deckt den Enum vollständig ab. Die vorherige
// Aufzählung von Hand wies neu hinzugekommene Arten stillschweigend ab.
const CONTACT_KINDS = Object.keys(contactKindLabels) as [ContactKind, ...ContactKind[]];

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
  // Freistellungsbescheinigung nach § 48b EStG. Liegt eine gültige vor,
  // entfällt der Steuerabzug bei Bauleistungen (§ 48 EStG) — ohne sie haftet
  // die Gemeinschaft für den nicht einbehaltenen Betrag (§ 48a Abs. 3 EStG).
  exemptionNumber: z.string().trim().max(50).optional(),
  exemptionValidUntil: z.string().trim().optional(),
});

/**
 * Datum der Freistellungsbescheinigung lesen.
 *
 * Ein unlesbares Datum wird zu `null`, nicht zu „heute". Ein stillschweigend
 * gesetztes Datum würde die Prüfung nach § 48 EStG entweder dauerhaft
 * stilllegen oder dauerhaft auslösen — beides schlimmer als ein leeres Feld.
 */
function freistellungsDatum(wert: string | undefined): Date | null {
  if (!wert) return null;
  const d = new Date(wert);
  return isNaN(d.getTime()) ? null : d;
}

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
    exemptionNumber: formData.get("exemptionNumber") || undefined,
    exemptionValidUntil: formData.get("exemptionValidUntil") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/kontakte/neu?fehler=eingabe");
  }

  await db.craftsman.create({
    data: {
      company: parsed.data.company || null,
      name: parsed.data.name,
      kind: parsed.data.kind,
      kindOther: sonstigesFreitext(parsed.data.kind, formData.get("kindOther")),
      trade: parsed.data.trade,
      email: parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null,
      phone: parsed.data.phone || null,
      preferredContact: parsed.data.preferredContact,
      notes: parsed.data.notes || null,
      // Interner Handwerker (Eigenleistung)
      isInternal: formData.get("isInternal") === "on",
      // Magic-Link-Token für das Auftragsportal (läuft ab, s. craftsman-token.ts)
      accessToken: neuesCraftsmanToken(),
      accessTokenIssuedAt: new Date(),
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

// ── Magic-Link verwalten (P1-13) ─────────────────────────────────────────────
// Der Link ist der einzige Zugang des Handwerkers — erneuern und widerrufen
// gehören deshalb in die Hand des Verwalters und ins Audit-Log: Wenn ein Link
// in falsche Hände gerät (weitergeleitete Mail genügt), muss er sich sofort
// entwerten lassen, nicht erst nach Ablauf der Frist.

export async function erneuereMagicLink(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id)))
    redirect(zurueckZu(formData, "?flash=keine-berechtigung"));
  await db.craftsman.update({
    where: { id },
    data: { accessToken: neuesCraftsmanToken(), accessTokenIssuedAt: new Date() },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.CRAFTSMAN_LINK_ROTATED,
    targetType: "Craftsman",
    targetId: id,
  });
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=link-erneuert"));
}

export async function widerrufeMagicLink(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id || !(await canVerwalterUseCraftsman(verwalter, id)))
    redirect(zurueckZu(formData, "?flash=keine-berechtigung"));
  await db.craftsman.update({
    where: { id },
    data: { accessToken: null, accessTokenIssuedAt: null },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.CRAFTSMAN_LINK_REVOKED,
    targetType: "Craftsman",
    targetId: id,
  });
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=link-widerrufen"));
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
    exemptionNumber: formData.get("exemptionNumber") || undefined,
    exemptionValidUntil: formData.get("exemptionValidUntil") || undefined,
  });
  if (!parsed.success) {
    redirect(zurueckZu(formData, "?fehler=eingabe"));
  }

  // Optionale Datei der Freistellungsbescheinigung.
  let bescheinigung: { storedName: string; fileName: string; mimeType: string } | null = null;
  const datei = formData.get("exemptionFile");
  if (datei instanceof File && datei.size > 0) {
    try {
      bescheinigung = await saveUpload(datei, DOCUMENT_TYPES);
    } catch (err) {
      // Vorher hieß es pauschal „erlaubt: Foto oder PDF" — auch dann, wenn die
      // Datei stimmte und die Ablage fehlte. Der Grund entscheidet, ob eine
      // andere Datei hilft oder nichts.
      console.error("Ablage einer Freistellungsbescheinigung fehlgeschlagen", err);
      redirect(
        zurueckZu(
          formData,
          `?fehler=bescheinigung&grund=${encodeURIComponent(ablageFehlerText(err))}`,
        ),
      );
    }
  }

  await db.craftsman.update({
    where: { id },
    data: {
      company: parsed.data.company || null,
      name: parsed.data.name,
      kind: parsed.data.kind,
      kindOther: sonstigesFreitext(parsed.data.kind, formData.get("kindOther")),
      trade: parsed.data.trade,
      email: parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null,
      phone: parsed.data.phone || null,
      preferredContact: parsed.data.preferredContact,
      notes: parsed.data.notes || null,
      exemptionNumber: parsed.data.exemptionNumber || null,
      exemptionValidUntil: freistellungsDatum(parsed.data.exemptionValidUntil),
      // Nur überschreiben, wenn wirklich eine neue Datei kam. Sonst löschte
      // jedes Speichern der Telefonnummer die hinterlegte Bescheinigung.
      ...(bescheinigung
        ? {
            exemptionStoredName: bescheinigung.storedName,
            exemptionFileName: bescheinigung.fileName,
            exemptionMimeType: bescheinigung.mimeType,
          }
        : {}),
    },
  });
  revalidatePath("/verwaltung/kontakte");
  redirect(zurueckZu(formData, "?flash=kontakt-gespeichert"));
}
