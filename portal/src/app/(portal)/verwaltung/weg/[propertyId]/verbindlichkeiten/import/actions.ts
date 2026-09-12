"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { GRUND_TEXT, pruefeRechnungenCsv, type RechnungZeile } from "@/lib/weg/rechnungen-csv";
import { loadWegProperty } from "@/lib/weg/scope";

const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2 MB — 500 Zeilen sind ein Bruchteil davon

/** Eine Zeile der Vorschau, so wie die Oberfläche sie zeigt. */
export type VorschauZeile = {
  zeile: number;
  status: "neu" | "vorhanden" | "fehler";
  title: string;
  creditor: string | null;
  amountCents: number | null;
  incurredOn: string | null;
  dueDate: string | null;
  /** Bei `fehler`: was nicht lesbar war; bei `vorhanden`: der Hinweis. */
  hinweis: string | null;
};

export type ImportVorschau =
  | {
      ok: true;
      fileName: string;
      /** Die Datei, damit Schritt 2 nichts erneut hochladen muss. */
      contentBase64: string;
      /** Welche Spalte der Datei welches Feld füllt. */
      zuordnung: { feld: string; spalte: string }[];
      /** Ohne Kopfzeile am Inhalt geraten — die Vorschau sagt das dazu. */
      geraten: boolean;
      zeilen: VorschauZeile[];
      neu: number;
      vorhanden: number;
      fehler: number;
    }
  | { ok: false; error: string };

function backTo(propertyId: string, suffix = ""): string {
  return `/verwaltung/weg/${propertyId}/verbindlichkeiten${suffix}`;
}

// Datumseingabe (YYYY-MM-DD) als lokaler Tagesbeginn — wie in ../actions.ts.
function tag(iso: string): Date {
  const [j, m, t] = iso.split("-").map(Number);
  return new Date(j, m - 1, t);
}

/** Schlüssel, unter dem eine Rechnung als „schon da" gilt: Bezeichnung + Betrag + Datum. */
function schluessel(v: { title: string; amountCents: number; incurredOn: Date }): string {
  return `${v.title.trim().toLowerCase()}|${v.amountCents}|${v.incurredOn.getFullYear()}-${v.incurredOn.getMonth()}-${v.incurredOn.getDate()}`;
}

async function bekannteSchluessel(propertyId: string): Promise<Set<string>> {
  const vorhanden = await db.verbindlichkeit.findMany({
    where: { propertyId },
    select: { title: true, amountCents: true, incurredOn: true },
  });
  return new Set(vorhanden.map(schluessel));
}

/**
 * Prüft die Datei vollständig und ordnet jede Zeile ein — neu, schon
 * vorhanden oder fehlerhaft. Gespeichert wird hier nichts.
 */
async function pruefen(
  propertyId: string,
  bytes: Uint8Array,
): Promise<
  | { zeilen: VorschauZeile[]; anzulegen: RechnungZeile[]; zuordnung: { feld: string; spalte: string }[]; geraten: boolean }
  | { error: string }
> {
  const p = pruefeRechnungenCsv(bytes);
  if (!p.ok) {
    const f = p.fehler;
    if (f.art === "leer") return { error: "Die Datei enthält keine Rechnungszeilen." };
    if (f.art === "zuviel") return { error: `Mehr als ${f.maximum} Zeilen — bitte die Datei aufteilen.` };
    const namen = f.fehlt.map((s) =>
      s === "betrag" ? "Betrag" : s === "datum" ? "Rechnungsdatum" : "Bezeichnung (oder Rechnungsnummer oder Gläubiger)",
    );
    return { error: `In der Kopfzeile fehlt: ${namen.join("; ")}. Laden Sie die Vorlage herunter, um die erwarteten Spaltennamen zu sehen.` };
  }

  const bekannt = await bekannteSchluessel(propertyId);
  const zeilen: VorschauZeile[] = [];
  const anzulegen: RechnungZeile[] = [];
  for (const z of p.zeilen) {
    if (!z.ok) {
      zeilen.push({
        zeile: z.zeile,
        status: "fehler",
        title: z.roh,
        creditor: null,
        amountCents: null,
        incurredOn: null,
        dueDate: null,
        hinweis: GRUND_TEXT[z.grund],
      });
      continue;
    }
    const d = z.daten;
    const k = schluessel({ title: d.title, amountCents: d.amountCents, incurredOn: tag(d.incurredOn) });
    const vorhanden = bekannt.has(k);
    if (!vorhanden) {
      bekannt.add(k); // Dubletten innerhalb der Datei nur einmal
      anzulegen.push(d);
    }
    zeilen.push({
      zeile: z.zeile,
      status: vorhanden ? "vorhanden" : "neu",
      title: d.title,
      creditor: d.creditor,
      amountCents: d.amountCents,
      incurredOn: d.incurredOn,
      dueDate: d.dueDate,
      hinweis: vorhanden ? "schon erfasst — wird übersprungen" : null,
    });
  }
  return { zeilen, anzulegen, zuordnung: p.zuordnung, geraten: p.geraten };
}

async function dateiAus(formData: FormData): Promise<{ bytes: Uint8Array; fileName: string; base64: string } | { error: string }> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_SIZE) return { error: "Die Datei ist größer als 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { bytes, fileName: file.name, base64: Buffer.from(bytes).toString("base64") };
  }
  const base64 = String(formData.get("contentBase64") ?? "");
  if (!base64) return { error: "Bitte eine CSV-Datei auswählen." };
  if (base64.length > MAX_CSV_SIZE * 1.4) return { error: "Die Datei ist größer als 2 MB." };
  return {
    bytes: new Uint8Array(Buffer.from(base64, "base64")),
    fileName: String(formData.get("fileName") ?? "rechnungen.csv"),
    base64,
  };
}

/** Schritt 1: Datei prüfen und Vorschau zurückgeben. */
export async function pruefeRechnungenAction(
  _prev: ImportVorschau | null,
  formData: FormData,
): Promise<ImportVorschau> {
  const verwalter = await requireVerwalter();
  const property = await loadWegProperty(verwalter, String(formData.get("propertyId") ?? ""));
  if (!property) return { ok: false, error: "Kein Zugriff auf dieses Objekt." };

  const datei = await dateiAus(formData);
  if ("error" in datei) return { ok: false, error: datei.error };
  const ergebnis = await pruefen(property.id, datei.bytes);
  if ("error" in ergebnis) return { ok: false, error: ergebnis.error };

  const zaehle = (s: VorschauZeile["status"]) => ergebnis.zeilen.filter((z) => z.status === s).length;
  return {
    ok: true,
    fileName: datei.fileName,
    contentBase64: datei.base64,
    zuordnung: ergebnis.zuordnung,
    geraten: ergebnis.geraten,
    zeilen: ergebnis.zeilen,
    neu: zaehle("neu"),
    vorhanden: zaehle("vorhanden"),
    fehler: zaehle("fehler"),
  };
}

/**
 * Schritt 2: die in der Vorschau als „neu" gezeigten Zeilen anlegen. Die Datei
 * wird dafür erneut geprüft — der Server verlässt sich nicht auf Zahlen, die
 * ein Formular mitschickt.
 */
export async function importiereRechnungenAction(formData: FormData) {
  const verwalter = await requireVerwalter();
  const property = await loadWegProperty(verwalter, String(formData.get("propertyId") ?? ""));
  if (!property) redirect("/verwaltung/weg");

  const datei = await dateiAus(formData);
  if ("error" in datei) redirect(backTo(property.id, "/import"));
  const ergebnis = await pruefen(property.id, datei.bytes);
  if ("error" in ergebnis) redirect(backTo(property.id, "/import"));

  const uebersprungen = ergebnis.zeilen.length - ergebnis.anzulegen.length;
  if (ergebnis.anzulegen.length > 0) {
    await db.verbindlichkeit.createMany({
      data: ergebnis.anzulegen.map((z) => ({
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        createdById: verwalter.id,
        title: z.title,
        kind: "RECHNUNG" as const,
        creditor: z.creditor,
        amountCents: z.amountCents,
        incurredOn: tag(z.incurredOn),
        dueDate: z.dueDate ? tag(z.dueDate) : null,
        note: z.note,
      })),
    });
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_VERBINDLICHKEIT_IMPORTED,
      targetType: "Property",
      targetId: property.id,
      meta: { anzahl: ergebnis.anzulegen.length, uebersprungen, datei: datei.fileName.slice(0, 120) },
    });
  }
  revalidatePath(backTo(property.id));
  redirect(backTo(property.id, `?importiert=${ergebnis.anzulegen.length}&uebersprungen=${uebersprungen}`));
}
