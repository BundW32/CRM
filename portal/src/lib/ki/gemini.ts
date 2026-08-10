// Gemeinsamer Zugang zu Googles Gemini-Diensten — für Assistent, Wissensindex
// und (perspektivisch) Triage. Zwei Wege zum selben Modell:
//
// 1. **Vertex AI mit Regionalendpunkt** (Empfehlung aus dem KI-Berater-Konzept,
//    Abschnitt 3.1): Verarbeitung in einer festen EU-Region, Vorgabe
//    europe-west3 (Frankfurt) — derselbe Standort wie die Datenbank. Zugang
//    über ein Google-Service-Konto: VERTEX_SERVICE_ACCOUNT_JSON enthält die
//    Schlüsseldatei, das OAuth-Token wird über eine signierte JWT geholt
//    (jose ist ohnehin Abhängigkeit dieses Projekts).
// 2. **Gemini Developer API** mit GEMINI_API_KEY — der bestehende Weg;
//    Verarbeitung dabei ggf. außerhalb der EU (so auch auf der
//    KI-Transparenzseite ausgewiesen).
//
// Sind beide konfiguriert, gewinnt Vertex. Der „global"-Endpunkt von Vertex
// ist BEWUSST gesperrt: Er bietet keine Data-Residency-Zusage, und genau die
// ist der einzige Grund, Vertex zu benutzen. SDKs haben Regionsangaben in der
// Praxis schon stillschweigend ignoriert — deshalb steht die Region hier
// ausgeschrieben in der URL und nirgends sonst.
import { importPKCS8, SignJWT } from "jose";

/**
 * Normalisiert einen Schalter aus der Umgebung ("true" mit oder ohne
 * mitkopierte Anführungszeichen). Historie in lib/assistant.ts — die Funktion
 * wohnt jetzt hier, damit assistant.ts und ki/* dieselbe Deutung teilen.
 */
export function schalter(raw: string | undefined): boolean {
  return bereinigt(raw).toLowerCase() === "true";
}

/** Rand-Whitespace und mitkopierte Anführungszeichen entfernen. */
export function bereinigt(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "");
}

// ── Plattformwahl ─────────────────────────────────────────────────────────────

export type Plattform =
  | { art: "vertex"; projekt: string; region: string }
  | { art: "developer" };

type VertexKonfig = {
  projekt: string;
  region: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

/** Die Vorgabe-Region: Frankfurt, passend zu Datenbank und Außendarstellung. */
export const VERTEX_REGION_VORGABE = "europe-west3";

function vertexKonfig(): VertexKonfig | null {
  const roh = bereinigt(process.env.VERTEX_SERVICE_ACCOUNT_JSON);
  if (!roh) return null;
  try {
    const sa = JSON.parse(roh) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
      token_uri?: string;
    };
    if (!sa.client_email || !sa.private_key) return null;
    const projekt = bereinigt(process.env.VERTEX_PROJECT_ID) || sa.project_id;
    if (!projekt) return null;
    const region = bereinigt(process.env.VERTEX_LOCATION) || VERTEX_REGION_VORGABE;
    // Kein globaler Endpunkt: keine Data-Residency-Zusage (Konzept 3.1).
    if (region.toLowerCase() === "global") {
      console.error(
        "[ki] VERTEX_LOCATION=global ist gesperrt — der globale Endpunkt bietet keine " +
          `Data Residency. Bitte eine Region setzen (z. B. ${VERTEX_REGION_VORGABE}).`,
      );
      return null;
    }
    return {
      projekt,
      region,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
      tokenUri: sa.token_uri || "https://oauth2.googleapis.com/token",
    };
  } catch {
    console.error("[ki] VERTEX_SERVICE_ACCOUNT_JSON ist kein gültiges JSON — Vertex bleibt aus.");
    return null;
  }
}

/**
 * Welcher Weg zu Google konfiguriert ist — oder null, wenn keiner.
 * Gibt nie Schlüsselmaterial heraus, nur Art, Projekt und Region.
 */
export function kiPlattform(): Plattform | null {
  const vertex = vertexKonfig();
  if (vertex) return { art: "vertex", projekt: vertex.projekt, region: vertex.region };
  if (bereinigt(process.env.GEMINI_API_KEY)) return { art: "developer" };
  return null;
}

// ── OAuth-Token für Vertex (Service-Konto) ────────────────────────────────────

let tokenCache: { token: string; gueltigBis: number } | null = null;

async function vertexToken(k: VertexKonfig): Promise<string> {
  if (tokenCache && tokenCache.gueltigBis > Date.now() + 60_000) return tokenCache.token;

  const key = await importPKCS8(k.privateKey, "RS256");
  const jetzt = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/cloud-platform",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(k.clientEmail)
    .setSubject(k.clientEmail)
    .setAudience(k.tokenUri)
    .setIssuedAt(jetzt)
    .setExpirationTime(jetzt + 3600)
    .sign(key);

  const res = await fetch(k.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token-Austausch fehlgeschlagen (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Token-Austausch ohne access_token beantwortet.");
  tokenCache = {
    token: data.access_token,
    gueltigBis: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

/** Baut URL + Header für einen Modellaufruf (`:generateContent` u. ä.). */
async function endpunkt(
  modell: string,
  methode: string,
): Promise<{ url: string; headers: Record<string, string> } | null> {
  const vertex = vertexKonfig();
  if (vertex) {
    const token = await vertexToken(vertex);
    return {
      // Region steht ausgeschrieben in Host UND Pfad — im Code-Review prüfbar,
      // von keinem SDK stillschweigend überschreibbar.
      url:
        `https://${vertex.region}-aiplatform.googleapis.com/v1/projects/${vertex.projekt}` +
        `/locations/${vertex.region}/publishers/google/models/${modell}:${methode}`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    };
  }
  const key = bereinigt(process.env.GEMINI_API_KEY);
  if (!key) return null;
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${modell}:${methode}?key=${key}`,
    headers: { "Content-Type": "application/json" },
  };
}

// ── Textgenerierung ───────────────────────────────────────────────────────────

export type GenerierErgebnis =
  | { ok: true; text: string }
  | {
      ok: false;
      /** HTTP-Status von Google; null bei Netz-/Zeitfehlern oder leerer Antwort. */
      status: number | null;
      /** finishReason/blockReason, wenn Google zwar antwortete, aber ohne Text. */
      grund: string | null;
      fehler: string;
    };

/**
 * Ein `generateContent`-Aufruf mit erzwungenem JSON-Schema.
 *
 * Fehler werden nie geworfen, sondern als Ergebnis zurückgegeben — die Aufrufer
 * (Assistent, Triage) dürfen nie eine Nutzeraktion blockieren.
 */
export async function generiereJson(opts: {
  modell: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperatur?: number;
  timeoutMs?: number;
}): Promise<GenerierErgebnis> {
  let ziel: Awaited<ReturnType<typeof endpunkt>>;
  try {
    ziel = await endpunkt(opts.modell, "generateContent");
  } catch (e) {
    return { ok: false, status: null, grund: null, fehler: meldung(e) };
  }
  if (!ziel) {
    return { ok: false, status: null, grund: null, fehler: "Kein Google-Zugang konfiguriert." };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(ziel.url, {
      method: "POST",
      headers: ziel.headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperatur ?? 0.1,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, grund: null, fehler: text.slice(0, 500) };
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const grund: string | null =
        data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? null;
      return { ok: false, status: null, grund, fehler: "Antwort ohne Text." };
    }
    return { ok: true, text };
  } catch (e) {
    return { ok: false, status: null, grund: null, fehler: meldung(e) };
  } finally {
    clearTimeout(timer);
  }
}

function meldung(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "Zeitüberschreitung.";
  return e instanceof Error ? e.message : String(e);
}

// ── Embeddings ────────────────────────────────────────────────────────────────

/**
 * 768 statt der 3.072 Dimensionen der Modellvorgabe: pgvector-HNSW trägt
 * höchstens 2.000. Google empfiehlt 768/1536 als Zielgrößen. Achtung: Unter
 * 3.072 liefert das Modell NICHT normierte Vektoren — `normalisiere` unten ist
 * deshalb Pflicht vor jedem Speichern/Suchen, sonst ist die Cosine-Distanz
 * verzerrt (Konzept 3.2).
 */
export const EMBEDDING_DIMENSIONEN = 768;

export const EMBEDDING_MODELL_VORGABE = "gemini-embedding-001";

function embeddingModell(): string {
  return bereinigt(process.env.GEMINI_EMBEDDING_MODEL) || EMBEDDING_MODELL_VORGABE;
}

export type EmbeddingZweck = "dokument" | "frage";

const ZWECK_ZU_TASKTYPE: Record<EmbeddingZweck, string> = {
  dokument: "RETRIEVAL_DOCUMENT",
  frage: "RETRIEVAL_QUERY",
};

/** L2-Normalisierung; Null-Vektoren bleiben unverändert. */
export function normalisiere(vektor: number[]): number[] {
  let quadratsumme = 0;
  for (const x of vektor) quadratsumme += x * x;
  if (quadratsumme === 0) return vektor;
  const norm = Math.sqrt(quadratsumme);
  return vektor.map((x) => x / norm);
}

// Vorsichtig klein: Beide APIs erlauben mehr, aber große Batches laufen in
// Token-Grenzen je Anfrage. Der Index wird selten neu gebaut — Robustheit
// schlägt hier Durchsatz.
const BATCH_GROESSE = 16;

/**
 * Bettet Texte ein — normalisiert, in Batches, über die konfigurierte
 * Plattform. `null` bei fehlender Konfiguration oder Fehlern (Aufrufer
 * arbeiten dann ohne Vektorsuche weiter; ein Fehler hier blockiert nie etwas).
 */
export async function embedTexte(
  texte: string[],
  zweck: EmbeddingZweck,
): Promise<number[][] | null> {
  if (texte.length === 0) return [];
  try {
    const vertex = vertexKonfig();
    const alle: number[][] = [];
    for (let i = 0; i < texte.length; i += BATCH_GROESSE) {
      const batch = texte.slice(i, i + BATCH_GROESSE);
      const vektoren = vertex ? await embedVertex(batch, zweck) : await embedDeveloper(batch, zweck);
      if (!vektoren || vektoren.length !== batch.length) return null;
      for (const v of vektoren) {
        if (v.length !== EMBEDDING_DIMENSIONEN) return null;
        alle.push(normalisiere(v));
      }
    }
    return alle;
  } catch (e) {
    console.error(`[ki] Einbettung fehlgeschlagen: ${meldung(e)}`);
    return null;
  }
}

async function embedDeveloper(texte: string[], zweck: EmbeddingZweck): Promise<number[][] | null> {
  const key = bereinigt(process.env.GEMINI_API_KEY);
  if (!key) return null;
  const modell = embeddingModell();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modell}:batchEmbedContents?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texte.map((text) => ({
          model: `models/${modell}`,
          content: { parts: [{ text }] },
          taskType: ZWECK_ZU_TASKTYPE[zweck],
          outputDimensionality: EMBEDDING_DIMENSIONEN,
        })),
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[ki] Embedding-API antwortete HTTP ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }
  const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
  const werte = (data.embeddings ?? []).map((e) => e.values ?? []);
  return werte.length === texte.length ? werte : null;
}

async function embedVertex(texte: string[], zweck: EmbeddingZweck): Promise<number[][] | null> {
  const ziel = await endpunkt(embeddingModell(), "predict");
  if (!ziel) return null;
  const res = await fetch(ziel.url, {
    method: "POST",
    headers: ziel.headers,
    body: JSON.stringify({
      instances: texte.map((content) => ({ content, task_type: ZWECK_ZU_TASKTYPE[zweck] })),
      parameters: { outputDimensionality: EMBEDDING_DIMENSIONEN },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[ki] Vertex-Embedding antwortete HTTP ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }
  const data = (await res.json()) as {
    predictions?: Array<{ embeddings?: { values?: number[] } }>;
  };
  const werte = (data.predictions ?? []).map((p) => p.embeddings?.values ?? []);
  return werte.length === texte.length ? werte : null;
}
