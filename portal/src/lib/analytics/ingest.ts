// Ingest-Läufe des Analytics-Dashboards.
//
// Jede Datenquelle (GA4, Search Console, Google Ads, Stripe/Geschäftszahlen,
// Newsletter) hat hier EINEN Eintrag. Der Rahmen ist für alle gleich:
// `runIngest` schreibt vor dem Lauf einen IngestRun („laeuft"), führt den
// Runner der Quelle aus und trägt danach Status, Zeilenzahl und ggf. die
// Fehlermeldung nach. Cron-Endpunkte und der manuelle Re-Sync auf
// /plattform/analytics/system rufen beide DIESEN Rahmen — ein Lauf ohne
// IngestRun-Eintrag darf nicht existieren, sonst ist die System-Seite blind.
//
// Phase 1 bringt nur den Rahmen mit: Alle Runner stehen auf null (= Quelle
// noch nicht angebunden); die System-Seite zeigt dafür den Hinweis, ab
// welcher Phase die Anbindung kommt. Ein Runner wird angebunden, indem sein
// `runner`-Feld eine Funktion bekommt — Registry, Seite und Cron-Rahmen
// bleiben unverändert.

import { db } from "@/lib/db";

export const INGEST_QUELLEN = ["ga4", "gsc", "ads", "stripe", "newsletter"] as const;
export type IngestQuelle = (typeof INGEST_QUELLEN)[number];

export type IngestErgebnis = {
  /** Geschriebene/aktualisierte Zeilen. */
  rows: number;
  /** true, wenn der Lauf nur teilweise durchkam (Quota, Teilfehler). */
  partial?: boolean;
  /** Freitext fürs Protokoll (z. B. abgedeckter Zeitraum, Abweichungen). */
  message?: string;
};

export type IngestRunner = () => Promise<IngestErgebnis>;

export type IngestQuelleInfo = {
  key: IngestQuelle;
  label: string;
  /** Wann/wie oft der Cron die Quelle zieht (Anzeige auf der System-Seite). */
  zeitplan: string;
  /** null = noch nicht angebunden; dann erklärt `folgt`, wann sie kommt. */
  runner: IngestRunner | null;
  folgt?: string;
};

export const ingestQuellen: readonly IngestQuelleInfo[] = [
  {
    key: "ga4",
    label: "GA4 (Google Analytics)",
    zeitplan: "täglich 03:00",
    runner: null,
    folgt: "Anbindung folgt in Phase 4 — vorher GA4-Property anlegen.",
  },
  {
    key: "gsc",
    label: "Search Console",
    zeitplan: "täglich 04:00",
    runner: null,
    folgt: "Anbindung folgt in Phase 4.",
  },
  {
    key: "ads",
    label: "Google Ads",
    zeitplan: "täglich 05:00",
    runner: null,
    folgt: "Anbindung folgt in Phase 4 — Developer-Token früh beantragen.",
  },
  {
    key: "stripe",
    label: "Geschäftszahlen (DB + Stripe)",
    // Läuft huckepack im täglichen Billing-Abgleich (05:00) — der
    // Vercel-Hobby-Plan kann keinen Stundentakt. Nach dem Plan-Upgrade:
    // eigenen Cron-Eintrag in vercel.json aufnehmen, dann hier "stündlich".
    zeitplan: "täglich 05:00 (stündlich nach Vercel-Upgrade)",
    // Dynamischer Import: Der Runner zieht Stripe-SDK und Mengenzählung mit —
    // das soll nicht jede Seite laden, die nur die Registry-Liste anzeigt.
    runner: () => import("./business-ingest").then((m) => m.businessIngestRunner()),
  },
  {
    key: "newsletter",
    label: "Newsletter",
    zeitplan: "täglich",
    runner: null,
    folgt: "Wartet auf die Festlegung des Newsletter-Providers.",
  },
];

export function ingestQuelle(key: string): IngestQuelleInfo | null {
  return ingestQuellen.find((q) => q.key === key) ?? null;
}

// Schmaler Ausschnitt des Prisma-Clients, den der Rahmen braucht — als
// Parameter, damit der Rahmen ohne Datenbank testbar ist (die Unit-Tests
// laufen auch im Vercel-Build, dort gibt es keine DB).
export type IngestRunDelegate = {
  create(args: {
    data: { source: string; status: string };
    select: { id: true };
  }): Promise<{ id: string }>;
  update(args: {
    where: { id: string };
    data: {
      finishedAt: Date;
      status: string;
      rowsWritten: number;
      message: string | null;
    };
  }): Promise<unknown>;
};

export type IngestLaufErgebnis = {
  status: "ok" | "partial" | "error";
  rowsWritten: number;
  message: string | null;
};

/**
 * Führt einen Runner im IngestRun-Rahmen aus. Wirft nie: Ein Fehler des
 * Runners wird als status "error" protokolliert und zurückgegeben — die
 * Cron-Endpunkte sollen 200 antworten und das Protokoll sprechen lassen,
 * sonst wiederholte Vercel den Lauf, der gerade dokumentiert schiefging.
 */
export async function runIngestMit(
  runs: IngestRunDelegate,
  quelle: IngestQuelle,
  runner: IngestRunner,
): Promise<IngestLaufErgebnis> {
  const { id } = await runs.create({
    data: { source: quelle, status: "laeuft" },
    select: { id: true },
  });
  let ergebnis: IngestLaufErgebnis;
  try {
    const r = await runner();
    ergebnis = {
      status: r.partial ? "partial" : "ok",
      rowsWritten: r.rows,
      message: r.message ?? null,
    };
  } catch (e) {
    ergebnis = {
      status: "error",
      rowsWritten: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
  await runs.update({
    where: { id },
    data: { finishedAt: new Date(), ...ergebnis },
  });
  return ergebnis;
}

/** Rahmen mit echter DB und Registry-Runner. null, wenn die Quelle (noch) keinen hat. */
export async function runIngest(quelle: IngestQuelle): Promise<IngestLaufErgebnis | null> {
  const info = ingestQuelle(quelle);
  if (!info?.runner) return null;
  return runIngestMit(db.ingestRun, quelle, info.runner);
}
