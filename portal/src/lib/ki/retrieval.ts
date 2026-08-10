// Vektorsuche im Wissensindex — mit Rollenfilter in der SQL-WHERE-Klausel.
//
// Die Rechte-Grenzen stehen HIER, nicht im Prompt: Ein Prompt ist keine
// Zugriffskontrolle (Konzept 3.2). Drei Schichten greifen übereinander:
// 1. Row-Level-Security der Tabelle (app.current_org_id je Transaktion),
// 2. der explizite Organisations- und Objekt-Filter in der Abfrage,
// 3. die Sichtbarkeitsmenge der Rolle — abgeleitet an GENAU EINER Stelle
//    (scopeFuer), gespiegelt an access.ts: Rolle → { ALLE, eigene Stufe },
//    BEIRAT nur für Objekte mit Beiratsmandat, Verwalter alles im Scope.
import type { User } from "@/generated/prisma/client";
import { db } from "../db";
import {
  boardPropertyIdsFor,
  ownedProperties,
  propertyIdsForVerwalter,
  tenantUnits,
} from "../access";
import { embedTexte } from "./gemini";

export type SuchScope = {
  organizationId: string;
  /** null = alle Objekte der Organisation (nur Verwalter ohne Zuteilung). */
  propertyIds: string[] | null;
  /** Chunks ohne Objektbezug (organisationsweite Dokumente) — nur Verwalter. */
  auchOhneObjekt: boolean;
  /** Sichtbarkeitsstufen als Text (Audience-Werte), ohne BEIRAT. */
  sichtbarkeiten: string[];
  /** Objekte, deren BEIRAT-Inhalte zusätzlich sichtbar sind. */
  beiratPropertyIds: string[];
};

/**
 * Die Sichtbarkeitsmenge des Nutzers — die zentrale Ableitung, von der das
 * Konzept (3.2) verlangt, dass es sie nur einmal gibt. Wer hier versehentlich
 * nur die eigene Rolle übergäbe, blendete Eigentümern die ALLE-Inhalte aus;
 * die Isolationstests halten beide Richtungen fest.
 */
export async function scopeFuer(user: User): Promise<SuchScope | null> {
  switch (user.role) {
    case "VERWALTER": {
      const ids = await propertyIdsForVerwalter(user);
      return {
        organizationId: user.organizationId,
        propertyIds: ids,
        auchOhneObjekt: true,
        // Verwalter sehen alle Stufen — auch BEIRAT — innerhalb ihres
        // Objekt-Scopes; die Objektgrenze zieht schon der Filter darüber.
        sichtbarkeiten: ["ALLE", "MIETER", "EIGENTUEMER", "BEIRAT"],
        beiratPropertyIds: [],
      };
    }
    case "EIGENTUEMER": {
      const [props, beirat] = await Promise.all([
        ownedProperties(user.id),
        boardPropertyIdsFor(user.id),
      ]);
      const eigene = props.map((p) => p.id);
      return {
        organizationId: user.organizationId,
        propertyIds: Array.from(new Set([...eigene, ...beirat])),
        auchOhneObjekt: false,
        sichtbarkeiten: ["ALLE", "EIGENTUEMER"],
        beiratPropertyIds: beirat,
      };
    }
    case "MIETER": {
      const units = await tenantUnits(user.id);
      return {
        organizationId: user.organizationId,
        propertyIds: Array.from(new Set(units.map((u) => u.propertyId))),
        auchOhneObjekt: false,
        sichtbarkeiten: ["ALLE", "MIETER"],
        beiratPropertyIds: [],
      };
    }
    default:
      // Handwerker haben kein Portalkonto im eigentlichen Sinn — kein Index-Zugriff.
      return null;
  }
}

export type ChunkTreffer = {
  quelleTyp: string;
  quelleId: string;
  propertyId: string | null;
  titel: string;
  abschnitt: string | null;
  text: string;
  score: number;
};

/**
 * Die eigentliche Datenbanksuche — getrennt von der Einbettung, damit die
 * Isolationstests sie mit handgebauten Vektoren direkt befragen können.
 */
export async function sucheChunks(
  scope: SuchScope,
  embedding: number[],
  limit = 12,
): Promise<ChunkTreffer[]> {
  const vektor = `[${embedding.join(",")}]`;
  const rows = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${scope.organizationId}, true)`;
    return tx.$queryRaw<
      Array<Omit<ChunkTreffer, "score"> & { score: number }>
    >`
      SELECT "quelleTyp", "quelleId", "propertyId", "titel", "abschnitt", "text",
             1 - ("embedding" <=> ${vektor}::vector) AS score
      FROM "KiChunk"
      WHERE "organizationId" = ${scope.organizationId}
        AND (
          ${scope.propertyIds === null}
          OR "propertyId" = ANY(${scope.propertyIds ?? []}::text[])
          OR (${scope.auchOhneObjekt} AND "propertyId" IS NULL)
        )
        AND (
          "sichtbarkeit"::text = ANY(${scope.sichtbarkeiten}::text[])
          OR ("sichtbarkeit"::text = 'BEIRAT'
              AND "propertyId" = ANY(${scope.beiratPropertyIds}::text[]))
        )
      ORDER BY "embedding" <=> ${vektor}::vector
      LIMIT ${limit}
    `;
  });
  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}

export type VektorTreffer = {
  type: string;
  title: string;
  href: string;
  snippet: string;
  score: number;
};

// Unterhalb dieser Ähnlichkeit gilt ein Chunk als nicht einschlägig — lieber
// „dazu finde ich nichts" als ein Zufallstreffer als Beleg (Konzept 3.5:
// keine Antwort ohne Beleg).
const MIN_SCORE = 0.5;

const TYP_ANZEIGE: Record<string, { label: string; href: (quelleId: string) => string }> = {
  beschluss: { label: "Beschluss", href: () => "/beschluesse" },
  versammlung: { label: "Versammlung", href: (id) => `/versammlungen/${id}` },
  antrag: { label: "Antrag", href: () => "/antraege" },
  aushang: { label: "Aushang", href: () => "/aushaenge" },
  dokument: { label: "Dokument", href: () => "/dokumente" },
};

/**
 * Vektorsuche für eine Nutzerfrage. Liefert null, wenn der Index nicht
 * verfügbar oder die Einbettung nicht möglich ist — der Assistent fällt dann
 * auf sein Schlüsselwort-Retrieval zurück. Fehler blockieren nie eine Antwort.
 */
export async function vektorSuche(user: User, frage: string): Promise<VektorTreffer[] | null> {
  try {
    const scope = await scopeFuer(user);
    if (!scope) return null;
    const eingebettet = await embedTexte([frage], "frage");
    if (!eingebettet || eingebettet.length === 0) return null;

    const treffer = await sucheChunks(scope, eingebettet[0]);
    return treffer
      .filter((t) => t.score >= MIN_SCORE)
      .map((t) => {
        const anzeige = TYP_ANZEIGE[t.quelleTyp] ?? { label: t.quelleTyp, href: () => "" };
        return {
          type: anzeige.label,
          title: t.abschnitt ? `${t.titel} — ${t.abschnitt}` : t.titel,
          href: anzeige.href(t.quelleId),
          snippet: t.text.replace(/\s+/g, " ").trim().slice(0, 600),
          score: t.score,
        };
      });
  } catch (e) {
    // Fehlende Tabelle/Erweiterung ist der erwartete Zustand ohne pgvector —
    // kein Protokolllärm. Alles andere gehört ins Log.
    const text = e instanceof Error ? e.message : String(e);
    if (!/KiChunk|does not exist|42P01|42704/.test(text)) {
      console.error(`[ki] Vektorsuche fehlgeschlagen: ${text.slice(0, 300)}`);
    }
    return null;
  }
}
