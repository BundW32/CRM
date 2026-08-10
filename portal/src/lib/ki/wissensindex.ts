// Aufbau und Pflege des KI-Wissensindex (Schicht 2 des KI-Berater-Konzepts:
// Mandanten-Inhalte). Indexiert werden portalinterne Texte — Beschlüsse,
// Versammlungen samt Tagesordnung, Eigentümer-Anträge, Aushänge und
// Dokument-TITEL. Keine Dateiinhalte: „Dokumente werden nicht ausgelesen" ist
// die Zusage der KI-Transparenzseite, und sie gilt, bis Phase 4 (Dokumenten-
// Analyse) samt angepasster Rechtstexte kommt.
//
// Vorgänge (Tickets) fehlen hier BEWUSST: Ihre Sichtbarkeit hängt an der
// einzelnen Person (Ersteller, Einheit, Zuweisung) und ließe sich nicht über
// die Sichtbarkeitsstufen dieser Tabelle abbilden. Sie bleiben im
// Live-Retrieval des Assistenten, das ticketWhereForUser durchläuft.
//
// Schreibzugriffe laufen in einer Transaktion mit gesetzter
// app.current_org_id — die Row-Level-Security der Tabelle verlangt das
// (siehe Migration 20260810120000_ki_wissensindex).
import { createHash } from "node:crypto";
import type { Audience } from "@/generated/prisma/client";
import { db } from "../db";
import {
  audienceLabels,
  documentCategoryLabels,
  resolutionStatusLabels,
} from "../labels";
import { zerlegeText } from "./chunking";
import { embedTexte } from "./gemini";

export type QuelleTyp = "beschluss" | "versammlung" | "antrag" | "aushang" | "dokument";

type Quelle = {
  typ: QuelleTyp;
  id: string;
  propertyId: string | null;
  titel: string;
  sichtbarkeit: Audience;
  text: string;
};

export type IndexErgebnis = {
  quellen: number;
  neu: number;
  unveraendert: number;
  entfernt: number;
  chunks: number;
};

export type IndexStatus = {
  verfuegbar: boolean;
  chunks: number;
  quellen: number;
  stand: Date | null;
};

/** Existiert die KiChunk-Tabelle? (Die Migration überspringt sie ohne pgvector.) */
export async function indexVerfuegbar(): Promise<boolean> {
  try {
    const rows = await db.$queryRaw<{ ok: boolean }[]>`
      SELECT to_regclass('public."KiChunk"') IS NOT NULL AS ok
    `;
    return rows[0]?.ok === true;
  } catch {
    return false;
  }
}

/** Zustand des Index einer Organisation — für die Einstellungsseite. */
export async function indexStatus(organizationId: string): Promise<IndexStatus> {
  if (!(await indexVerfuegbar())) {
    return { verfuegbar: false, chunks: 0, quellen: 0, stand: null };
  }
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return tx.$queryRaw<{ chunks: bigint; quellen: bigint; stand: Date | null }[]>`
      SELECT count(*) AS chunks,
             count(DISTINCT ("quelleTyp", "quelleId")) AS quellen,
             max("erstelltAm") AS stand
      FROM "KiChunk"
      WHERE "organizationId" = ${organizationId}
    `;
  });
  const r = rows[0];
  return {
    verfuegbar: true,
    chunks: Number(r?.chunks ?? 0),
    quellen: Number(r?.quellen ?? 0),
    stand: r?.stand ?? null,
  };
}

// WEG-Verfahrensinhalte sind Eigentümer-Sache (wie im Assistenten: Mieter
// sehen weder Beschlüsse noch Versammlungen noch Anträge).
const WEG_SICHTBARKEIT: Audience = "EIGENTUEMER";

async function sammleQuellen(organizationId: string): Promise<Quelle[]> {
  const [beschluesse, versammlungen, antraege, aushaenge, dokumente] = await Promise.all([
    db.resolution.findMany({
      where: { organizationId },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        status: true,
        propertyId: true,
        decidedAt: true,
      },
    }),
    db.ownersMeeting.findMany({
      where: { organizationId },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        location: true,
        propertyId: true,
        agendaItems: {
          orderBy: { sortOrder: "asc" },
          select: { sortOrder: true, title: true, description: true },
        },
      },
    }),
    db.ownerMotion.findMany({
      where: { organizationId },
      select: { id: true, title: true, description: true, status: true, propertyId: true },
    }),
    db.announcement.findMany({
      where: { organizationId },
      select: { id: true, title: true, body: true, audience: true, propertyId: true },
    }),
    // Nur Dokumente ohne gezielte Empfänger: 1:1-Freigaben sind Personensache
    // und lassen sich nicht als Sichtbarkeitsstufe abbilden.
    db.document.findMany({
      where: { organizationId, recipients: { none: {} } },
      select: { id: true, title: true, category: true, audience: true, propertyId: true },
    }),
  ]);

  const quellen: Quelle[] = [];

  for (const b of beschluesse) {
    const nr = b.number ? ` Nr. ${b.number}` : "";
    quellen.push({
      typ: "beschluss",
      id: b.id,
      propertyId: b.propertyId,
      titel: `Beschluss${nr}: ${b.title}`,
      sichtbarkeit: WEG_SICHTBARKEIT,
      text:
        `Beschluss${nr}: ${b.title}\n` +
        `Status: ${resolutionStatusLabels[b.status]}` +
        (b.decidedAt ? ` (entschieden am ${datum(b.decidedAt)})` : "") +
        `\n\n${b.description}`,
    });
  }

  for (const v of versammlungen) {
    const tops = v.agendaItems
      .map((t, i) => `TOP ${t.sortOrder || i + 1}: ${t.title}${t.description ? ` — ${t.description}` : ""}`)
      .join("\n");
    quellen.push({
      typ: "versammlung",
      id: v.id,
      propertyId: v.propertyId,
      titel: v.title,
      sichtbarkeit: WEG_SICHTBARKEIT,
      text:
        `Eigentümerversammlung: ${v.title}\n` +
        `Termin: ${datum(v.scheduledAt)}${v.location ? `, Ort: ${v.location}` : ""}\n` +
        `Status: ${v.status}` +
        (tops ? `\n\nTagesordnung:\n${tops}` : ""),
    });
  }

  for (const a of antraege) {
    quellen.push({
      typ: "antrag",
      id: a.id,
      propertyId: a.propertyId,
      titel: `Antrag: ${a.title}`,
      sichtbarkeit: WEG_SICHTBARKEIT,
      text: `Eigentümer-Antrag: ${a.title}\nStatus: ${a.status}\n\n${a.description}`,
    });
  }

  for (const a of aushaenge) {
    quellen.push({
      typ: "aushang",
      id: a.id,
      propertyId: a.propertyId,
      titel: a.title,
      sichtbarkeit: a.audience,
      text: `Aushang: ${a.title}\n\n${a.body}`,
    });
  }

  for (const d of dokumente) {
    quellen.push({
      typ: "dokument",
      id: d.id,
      propertyId: d.propertyId,
      titel: d.title,
      sichtbarkeit: d.audience,
      // Nur Titel und Kategorie — keine Dateiinhalte (Zusage der Transparenzseite).
      text: `Dokument: ${d.title}\nKategorie: ${documentCategoryLabels[d.category]} (${audienceLabels[d.audience]})`,
    });
  }

  return quellen;
}

function datum(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function quellenHash(q: Quelle): string {
  return createHash("sha256")
    .update(`${q.titel}\n${q.text}\n${q.sichtbarkeit}\n${q.propertyId ?? ""}`)
    .digest("hex");
}

const schluessel = (typ: string, id: string) => `${typ}:${id}`;

/** Für Tests injizierbar — die echten Aufrufe betten über Gemini ein. */
export type Einbetter = (texte: string[]) => Promise<number[][] | null>;

/**
 * Baut den Wissensindex einer Organisation auf bzw. gleicht ihn ab:
 * unveränderte Quellen (gleicher Hash) bleiben liegen, geänderte werden neu
 * eingebettet, verschwundene Quellen werden entfernt. Der Abgleich ist damit
 * beliebig oft wiederholbar und kostet nur für tatsächliche Änderungen.
 *
 * Liefert null, wenn der Index nicht verfügbar ist (kein pgvector) oder die
 * Einbettung fehlschlägt — nie eine Exception in den Aufrufer.
 */
export async function indexiereOrganisation(
  organizationId: string,
  einbetter: Einbetter = (texte) => embedTexte(texte, "dokument"),
): Promise<IndexErgebnis | null> {
  if (!(await indexVerfuegbar())) return null;

  const quellen = await sammleQuellen(organizationId);

  const bestand = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return tx.$queryRaw<{ quelleTyp: string; quelleId: string; inhaltHash: string }[]>`
      SELECT DISTINCT "quelleTyp", "quelleId", "inhaltHash"
      FROM "KiChunk"
      WHERE "organizationId" = ${organizationId}
    `;
  });
  const bestandNachQuelle = new Map(bestand.map((b) => [schluessel(b.quelleTyp, b.quelleId), b.inhaltHash]));
  const aktuelleSchluessel = new Set(quellen.map((q) => schluessel(q.typ, q.id)));

  const zuEntfernen = bestand.filter((b) => !aktuelleSchluessel.has(schluessel(b.quelleTyp, b.quelleId)));
  const geaendert = quellen.filter((q) => bestandNachQuelle.get(schluessel(q.typ, q.id)) !== quellenHash(q));
  const unveraendert = quellen.length - geaendert.length;

  // Chunks der geänderten Quellen bilden und einbetten — BEVOR die
  // Schreib-Transaktion beginnt: Netzaufrufe gehören nicht in eine offene
  // Transaktion.
  type NeuerChunk = {
    quelle: Quelle;
    hash: string;
    text: string;
    abschnitt: string | null;
    reihenfolge: number;
  };
  const neueChunks: NeuerChunk[] = [];
  for (const quelle of geaendert) {
    const hash = quellenHash(quelle);
    for (const chunk of zerlegeText(quelle.text)) {
      neueChunks.push({ quelle, hash, ...chunk });
    }
  }

  let vektoren: number[][] = [];
  if (neueChunks.length > 0) {
    const eingebettet = await einbetter(neueChunks.map((c) => c.text));
    if (!eingebettet || eingebettet.length !== neueChunks.length) return null;
    vektoren = eingebettet;
  }

  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
      for (const b of zuEntfernen) {
        await tx.$executeRaw`
          DELETE FROM "KiChunk"
          WHERE "organizationId" = ${organizationId}
            AND "quelleTyp" = ${b.quelleTyp} AND "quelleId" = ${b.quelleId}
        `;
      }
      for (const q of geaendert) {
        await tx.$executeRaw`
          DELETE FROM "KiChunk"
          WHERE "organizationId" = ${organizationId}
            AND "quelleTyp" = ${q.typ} AND "quelleId" = ${q.id}
        `;
      }
      for (const [i, c] of neueChunks.entries()) {
        const vektor = `[${vektoren[i].join(",")}]`;
        await tx.$executeRaw`
          INSERT INTO "KiChunk"
            ("organizationId", "propertyId", "quelleTyp", "quelleId", "titel",
             "abschnitt", "reihenfolge", "sichtbarkeit", "inhaltHash", "text", "embedding")
          VALUES
            (${organizationId}, ${c.quelle.propertyId}, ${c.quelle.typ}, ${c.quelle.id},
             ${c.quelle.titel}, ${c.abschnitt}, ${c.reihenfolge},
             ${c.quelle.sichtbarkeit}::"Audience", ${c.hash}, ${c.text}, ${vektor}::vector)
        `;
      }
    },
    // Der Vorgabewert (5 s) ist für einen Erst-Aufbau mit vielen Quellen zu knapp.
    { timeout: 120_000 },
  );

  return {
    quellen: quellen.length,
    neu: geaendert.length,
    unveraendert,
    entfernt: zuEntfernen.length,
    chunks: neueChunks.length,
  };
}
