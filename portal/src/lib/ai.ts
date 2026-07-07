// KI-Triage über die Google-Gemini-API. DSGVO: Es werden Freitext-Inhalte
// (Titel/Beschreibung) an Google (US) gesendet. Daher standardmäßig AUS und nur
// aktiv, wenn der Betreiber es ausdrücklich freigibt (AI_TRIAGE_ENABLED="true") UND
// ein GEMINI_API_KEY gesetzt ist. Bei Aktivierung sind AVV + EU-Datenzusatz mit
// Google sowie eine Offenlegung in der Datenschutzerklärung erforderlich.
// Fehler blockieren nie eine Aktion.
import type { TicketPriority, Trade } from "@/generated/prisma/client";
import { tradeLabels } from "./labels";

const TRADE_KEYS = Object.keys(tradeLabels) as Trade[];
const PRIORITIES = ["NIEDRIG", "NORMAL", "HOCH", "DRINGEND"] as const;

export type TriageResult = {
  trade: Trade | null;
  priority: TicketPriority;
  summary: string;
};

export async function classifyTicket(input: {
  title: string;
  description: string;
}): Promise<TriageResult | null> {
  // DSGVO: Opt-in-Pflicht. Ohne ausdrückliche Freigabe werden KEINE Inhalte an
  // Google gesendet (auch wenn ein Key vorhanden wäre).
  if (process.env.AI_TRIAGE_ENABLED !== "true") return null;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  const prompt =
    `Du bist Triage-Assistent einer deutschen Hausverwaltung. Ordne die folgende ` +
    `Schadensmeldung/Anfrage ein.\n` +
    `- Wähle das passende Gewerk aus dieser Liste (Schlüssel): ${TRADE_KEYS.join(", ")}. ` +
    `Wenn keines passt, "NONE".\n` +
    `- Priorität: NIEDRIG, NORMAL, HOCH oder DRINGEND. "DRINGEND" nur bei Gefahr oder ` +
    `akutem Schaden (z. B. Wasserrohrbruch, Heizungsausfall im Winter, Stromausfall, ` +
    `verstopfter Abfluss mit Überlauf).\n` +
    `- summary: eine knappe Zusammenfassung in einem deutschen Satz.\n\n` +
    `Titel: ${input.title}\n` +
    `Beschreibung: ${input.description}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                trade: { type: "string", enum: [...TRADE_KEYS, "NONE"] },
                priority: { type: "string", enum: [...PRIORITIES] },
                summary: { type: "string" },
              },
              required: ["trade", "priority", "summary"],
            },
          },
        }),
      }
    ).finally(() => clearTimeout(timer));

    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as { trade?: string; priority?: string; summary?: string };
    const trade = parsed.trade && TRADE_KEYS.includes(parsed.trade as Trade)
      ? (parsed.trade as Trade)
      : null;
    const priority = (PRIORITIES as readonly string[]).includes(parsed.priority ?? "")
      ? (parsed.priority as TicketPriority)
      : "NORMAL";
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";
    return { trade, priority, summary };
  } catch {
    return null;
  }
}
