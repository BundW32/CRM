"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { parseRechnungenCsv, type RechnungenCsvFehler } from "@/lib/weg/rechnungen-csv";
import { loadWegProperty } from "@/lib/weg/scope";

function backTo(propertyId: string, suffix = ""): string {
  return `/verwaltung/weg/${propertyId}/verbindlichkeiten${suffix}`;
}

function backToForm(propertyId: string, suffix = ""): string {
  return `/verwaltung/weg/${propertyId}/verbindlichkeiten/neu${suffix}`;
}

const schema = z.object({
  propertyId: z.string().min(1),
  id: z.string().optional(),
  title: z.string().trim().min(2).max(200),
  kind: z.enum(["RECHNUNG", "DARLEHEN", "SONSTIGE"]),
  creditor: z.string().trim().max(160).optional(),
  amount: z.string().min(1),
  incurredOn: z.string().min(1),
  dueDate: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
});

// Datumseingabe aus `<input type="date">` (YYYY-MM-DD) als lokaler Tagesbeginn.
// Über `new Date("2026-11-03")` käme UTC-Mitternacht heraus — in Deutschland
// also der 3.11. um 01:00 bzw. 02:00. Bei Stichtagsvergleichen kippt das den Tag.
function tag(iso: string): Date | null {
  const [j, m, t] = iso.split("-").map(Number);
  if (!j || !m || !t) return null;
  const d = new Date(j, m - 1, t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveVerbindlichkeit(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = schema.safeParse({
    propertyId: formData.get("propertyId"),
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    kind: formData.get("kind"),
    creditor: String(formData.get("creditor") ?? "") || undefined,
    amount: formData.get("amount"),
    incurredOn: formData.get("incurredOn"),
    dueDate: String(formData.get("dueDate") ?? "") || undefined,
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const bearbeitet = parsed.data.id ? `?id=${parsed.data.id}` : "";
  const amountCents = parseEuroToCents(parsed.data.amount);
  if (amountCents === null || amountCents <= 0) {
    redirect(backToForm(property.id, `${bearbeitet ? `${bearbeitet}&` : "?"}fehler=betrag`));
  }
  const incurredOn = tag(parsed.data.incurredOn);
  if (!incurredOn) {
    redirect(backToForm(property.id, `${bearbeitet ? `${bearbeitet}&` : "?"}fehler=datum`));
  }
  const dueDate = parsed.data.dueDate ? tag(parsed.data.dueDate) : null;

  const data = {
    title: parsed.data.title,
    kind: parsed.data.kind,
    creditor: parsed.data.creditor ?? null,
    amountCents,
    incurredOn,
    dueDate,
    note: parsed.data.note ?? null,
  };

  let id = parsed.data.id ?? null;
  if (id) {
    // Nur ändern, was zu diesem Objekt gehört (IDOR-Schutz).
    const vorhanden = await db.verbindlichkeit.findFirst({
      where: { id, propertyId: property.id },
      select: { id: true },
    });
    if (!vorhanden) redirect(backTo(property.id, "?fehler=nichtgefunden"));
    await db.verbindlichkeit.update({ where: { id }, data });
  } else {
    const created = await db.verbindlichkeit.create({
      data: {
        ...data,
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        createdById: verwalter.id,
      },
    });
    id = created.id;
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_VERBINDLICHKEIT_SAVED,
    targetType: "Verbindlichkeit",
    targetId: id,
  });
  revalidatePath(backTo(property.id));
  redirect(backTo(property.id, "?flash=gespeichert"));
}

/**
 * Als beglichen markieren — oder die Markierung zurücknehmen.
 *
 * Bewusst kein Löschen: Der Vermögensbericht blickt auf einen Stichtag. Wer
 * eine im Januar bezahlte Rechnung entfernt, ändert damit den bereits
 * beschlossenen Bericht zum 31.12. rückwirkend.
 */
export async function toggleBeglichen(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const vorhanden = await db.verbindlichkeit.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true, settledAt: true },
  });
  if (!vorhanden) redirect(backTo(property.id, "?fehler=nichtgefunden"));

  await db.verbindlichkeit.update({
    where: { id: vorhanden.id },
    data: { settledAt: vorhanden.settledAt ? null : new Date() },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_VERBINDLICHKEIT_SETTLED,
    targetType: "Verbindlichkeit",
    targetId: vorhanden.id,
  });
  revalidatePath(backTo(property.id));
  redirect(backTo(property.id, "?flash=gespeichert"));
}

/**
 * Löschen — nur für Fehleingaben.
 *
 * Der reguläre Weg ist „beglichen", nicht Löschen. Deshalb ist diese Aktion in
 * der Oberfläche als Korrektur beschriftet und nicht als Erledigung.
 */
export async function deleteVerbindlichkeit(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const vorhanden = await db.verbindlichkeit.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (vorhanden) {
    await db.verbindlichkeit.delete({ where: { id: vorhanden.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_VERBINDLICHKEIT_DELETED,
      targetType: "Verbindlichkeit",
      targetId: vorhanden.id,
    });
  }
  revalidatePath(backTo(property.id));
  redirect(backTo(property.id, "?flash=geloescht"));
}

const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2 MB — 500 Zeilen sind ein Bruchteil davon

/** Fehlercode für die URL — die Liste übersetzt ihn in einen Satz. */
function csvFehlerSuffix(f: RechnungenCsvFehler): string {
  switch (f.art) {
    case "leer":
      return "?fehler=csv-leer";
    case "zuviel":
      return `?fehler=csv-zuviel&maximum=${f.maximum}`;
    case "kopfzeile":
      return `?fehler=csv-kopfzeile&fehlt=${f.fehlt.join(",")}`;
    default:
      return `?fehler=csv-${f.art}&zeile=${f.zeile}`;
  }
}

/**
 * Rechnungen aus einer CSV-Datei als Verbindlichkeiten anlegen.
 *
 * Alles oder nichts: Lässt sich eine Zeile nicht lesen, wird nichts angelegt
 * und die Zeile gemeldet. Zeilen, die es schon gibt (gleiche Bezeichnung,
 * gleicher Betrag, gleiches Datum), werden übersprungen — wer dieselbe Datei
 * zweimal hochlädt, bekommt keine Dubletten, sondern die Zahl der
 * übersprungenen Zeilen.
 */
export async function importVerbindlichkeitenCsv(formData: FormData) {
  const verwalter = await requireVerwalter();
  const property = await loadWegProperty(verwalter, String(formData.get("propertyId") ?? ""));
  if (!property) redirect("/verwaltung/weg");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(backTo(property.id, "?fehler=csv-leer"));
  if (file.size > MAX_CSV_SIZE) redirect(backTo(property.id, "?fehler=csv-gross"));

  const ergebnis = parseRechnungenCsv(new Uint8Array(await file.arrayBuffer()));
  if (!ergebnis.ok) redirect(backTo(property.id, csvFehlerSuffix(ergebnis.fehler)));

  const vorhanden = await db.verbindlichkeit.findMany({
    where: { propertyId: property.id },
    select: { title: true, amountCents: true, incurredOn: true },
  });
  const schluessel = (v: { title: string; amountCents: number; incurredOn: Date }) =>
    `${v.title.trim().toLowerCase()}|${v.amountCents}|${v.incurredOn.getFullYear()}-${v.incurredOn.getMonth()}-${v.incurredOn.getDate()}`;
  const bekannt = new Set(vorhanden.map(schluessel));

  const neu = [];
  let uebersprungen = 0;
  for (const z of ergebnis.zeilen) {
    const incurredOn = tag(z.incurredOn)!;
    const dueDate = z.dueDate ? tag(z.dueDate) : null;
    const eintrag = {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      createdById: verwalter.id,
      title: z.title,
      kind: "RECHNUNG" as const,
      creditor: z.creditor,
      amountCents: z.amountCents,
      incurredOn,
      dueDate,
      note: z.note,
    };
    const k = schluessel(eintrag);
    if (bekannt.has(k)) {
      uebersprungen++;
      continue;
    }
    bekannt.add(k); // auch Dubletten innerhalb der Datei nur einmal
    neu.push(eintrag);
  }

  if (neu.length > 0) {
    await db.verbindlichkeit.createMany({ data: neu });
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_VERBINDLICHKEIT_IMPORTED,
      targetType: "Property",
      targetId: property.id,
      meta: { anzahl: neu.length, uebersprungen, datei: file.name.slice(0, 120) },
    });
  }
  revalidatePath(backTo(property.id));
  redirect(backTo(property.id, `?importiert=${neu.length}&uebersprungen=${uebersprungen}`));
}
