// KI-Assistent „Frag deine Gemeinschaft" – beantwortet Fragen AUSSCHLIESSLICH aus
// den Inhalten, die der fragende Nutzer sehen darf (Rechte werden bereits beim
// Datenabruf über die access.ts-Helfer erzwungen → kein Datenleck über Rollen/
// Mandanten hinweg). Erdung auf strukturiertem DB-Text (Beschlüsse, Aushänge,
// Versammlungen, Anträge, Vorgänge, Dokument-Titel) – KEINE PDF-Extraktion.
//
// DSGVO: Wie bei der Triage werden Freitext-Inhalte an Google (Gemini) gesendet.
// Daher standardmäßig AUS – nur aktiv bei AI_ASSISTANT_ENABLED="true" UND
// gesetztem GEMINI_API_KEY. Fehler blockieren nie eine Aktion.
import type { Prisma, User } from "@/generated/prisma/client";
import { db } from "./db";
import {
  announcementWhereForUser,
  documentWhereForUser,
  ownedProperties,
  propertyIdsForVerwalter,
  ticketWhereForUser,
} from "./access";
import { documentCategoryLabels, roleLabels, ticketStatusLabels } from "./labels";
import { helpForUser } from "./assistant-help";

export type AssistantSource = {
  type: string; // z. B. "Beschluss", "Aushang", "Vorgang"
  title: string;
  href: string;
  snippet: string;
};

export type AssistantResult = {
  answer: string;
  sources: AssistantSource[];
};

export function isAssistantEnabled(): boolean {
  return process.env.AI_ASSISTANT_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

// Rollen, die den Assistenten sehen (WEG-Inhalte sind Eigentümer-/Verwalter-Sache).
export function canUseAssistant(user: Pick<User, "role">): boolean {
  return user.role === "VERWALTER" || user.role === "EIGENTUEMER";
}

const STOPWORDS = new Set([
  "der","die","das","und","oder","ein","eine","einen","dem","den","des","was","wie","wo",
  "wann","warum","wer","ist","sind","war","waren","hat","haben","hatte","wurde","werden",
  "für","von","mit","auf","zu","zum","zur","im","in","an","am","bei","aus","über","unter",
  "gibt","es","auch","noch","mir","mich","ich","wir","uns","unsere","unser","sich","nicht",
  "wurde","wird","kann","könnt","bitte","mal","denn","doch","schon","aber","als","um",
]);

function terms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^a-zäöüß0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  );
}

// Punktzahl: wie viele Frage-Begriffe (als Teilstring) im Text vorkommen.
function score(text: string, ts: string[]): number {
  const hay = text.toLowerCase();
  let s = 0;
  for (const t of ts) if (hay.includes(t)) s += 1;
  return s;
}

type Candidate = AssistantSource & { updatedAt: number; _score: number };

// WEG-Objekt-Filter (Beschlüsse/Versammlungen/Anträge) je nach Rolle.
// null = für diese Rolle nicht zugänglich (Mieter/Handwerker).
async function wegPropertyWhere(user: User): Promise<Prisma.ResolutionWhereInput | null> {
  if (user.role === "VERWALTER") {
    const ids = await propertyIdsForVerwalter(user);
    return ids === null ? { organizationId: user.organizationId } : { propertyId: { in: ids } };
  }
  if (user.role === "EIGENTUEMER") {
    const props = await ownedProperties(user.id);
    return { propertyId: { in: props.map((p) => p.id) } };
  }
  return null;
}

// Sammelt rechte-geprüfte Kandidaten aus allen Quellen (jüngste je Typ), bewertet
// sie nach Begriffs-Überlappung mit der Frage und liefert die besten `limit`.
// Exportiert für Tests (belegt die Rechte-Filterung je Rolle).
export async function retrieveContext(user: User, question: string, limit = 14): Promise<AssistantSource[]> {
  const ts = terms(question);
  const out: Candidate[] = [];
  const wegWhere = await wegPropertyWhere(user);

  // Objektname als Präfix, damit die KI Aussagen dem richtigen Objekt zuordnet.
  const objTag = (name?: string | null) => (name ? `[${name}] ` : "");

  const [announcements, documents, tickets] = await Promise.all([
    db.announcement.findMany({
      where: await announcementWhereForUser(user),
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { property: { select: { name: true } } },
    }),
    db.document.findMany({
      where: await documentWhereForUser(user),
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        category: true,
        createdAt: true,
        property: { select: { name: true } },
      },
    }),
    db.ticket.findMany({
      where: await ticketWhereForUser(user),
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        status: true,
        updatedAt: true,
        property: { select: { name: true } },
      },
    }),
  ]);

  for (const a of announcements) {
    out.push(cand("Aushang", a.title, "/aushaenge", `${objTag(a.property?.name)}${a.body}`, a.createdAt, ts));
  }
  for (const d of documents) {
    out.push(
      cand("Dokument", d.title, "/dokumente", `${objTag(d.property?.name)}${documentCategoryLabels[d.category]}`, d.createdAt, ts),
    );
  }
  for (const t of tickets) {
    out.push(
      cand(
        "Vorgang",
        `#${t.number} · ${t.title}`,
        `/vorgaenge/${t.id}`,
        `${objTag(t.property?.name)}${ticketStatusLabels[t.status]} — ${t.description}`,
        t.updatedAt,
        ts,
      ),
    );
  }

  if (wegWhere) {
    const [resolutions, meetings, motions] = await Promise.all([
      db.resolution.findMany({
        where: wegWhere,
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          property: { select: { name: true } },
        },
      }),
      db.ownersMeeting.findMany({
        where: wegWhere as Prisma.OwnersMeetingWhereInput,
        orderBy: { scheduledAt: "desc" },
        take: 20,
        include: {
          agendaItems: { select: { title: true, description: true } },
          property: { select: { name: true } },
        },
      }),
      db.ownerMotion.findMany({
        where: wegWhere as Prisma.OwnerMotionWhereInput,
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          property: { select: { name: true } },
        },
      }),
    ]);
    for (const r of resolutions) {
      const nr = r.number ? `Nr. ${r.number} · ` : "";
      out.push(
        cand("Beschluss", `${nr}${r.title}`, "/beschluesse", `${objTag(r.property?.name)}${r.status} — ${r.description}`, r.createdAt, ts),
      );
    }
    for (const m of meetings) {
      const tops = m.agendaItems.map((i) => i.title + (i.description ? `: ${i.description}` : "")).join(" | ");
      out.push(
        cand("Versammlung", m.title, `/versammlungen/${m.id}`, `${objTag(m.property?.name)}${m.status} — TOPs: ${tops}`, m.scheduledAt, ts),
      );
    }
    for (const mo of motions) {
      out.push(cand("Antrag", mo.title, "/antraege", `${objTag(mo.property?.name)}${mo.status} — ${mo.description}`, mo.createdAt, ts));
    }
  }

  // Bedienhilfe-Themen der Rolle als zusätzliche Quellen (nur wenn Begriffe der
  // Frage treffen – Datum epoch 0, damit sie nicht als Füllmaterial hochkommen).
  for (const h of helpForUser(user.role)) {
    out.push(cand("Bedienhilfe", h.title, h.href, h.body, new Date(0), ts));
  }

  // Beste zuerst: höhere Trefferzahl, bei Gleichstand aktueller. Ohne jeden
  // Treffer greifen wir auf die jüngsten Einträge zurück (Kontext statt Leere).
  out.sort((a, b) => b._score - a._score || b.updatedAt - a.updatedAt);
  const anyHit = out.some((c) => c._score > 0);
  const pool = anyHit ? out.filter((c) => c._score > 0) : out;
  return pool.slice(0, limit).map(({ type, title, href, snippet }) => ({ type, title, href, snippet }));
}

function cand(
  type: string,
  title: string,
  href: string,
  body: string,
  date: Date,
  ts: string[],
): Candidate {
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 400);
  return {
    type,
    title,
    href,
    snippet,
    updatedAt: date.getTime(),
    _score: score(`${title} ${snippet}`, ts),
  };
}

export async function askAssistant(user: User, question: string): Promise<AssistantResult> {
  const q = question.trim().slice(0, 500);
  if (!q) return { answer: "Bitte stellen Sie eine Frage.", sources: [] };
  if (!isAssistantEnabled()) {
    return { answer: "Der Assistent ist derzeit nicht aktiviert.", sources: [] };
  }

  const sources = await retrieveContext(user, q);
  if (sources.length === 0) {
    return { answer: "Dazu finde ich in Ihren Unterlagen nichts.", sources: [] };
  }

  const context = sources
    .map((s, i) => `[${i + 1}] (${s.type}) ${s.title}\n${s.snippet}`)
    .join("\n\n");

  const prompt =
    `Du bist der Assistent des Kundenportals einer deutschen Hausverwaltung. ` +
    `Der fragende Nutzer hat die Rolle „${roleLabels[user.role]}" – richte Antwort und ` +
    `Hilfestellung darauf aus. ` +
    `Beantworte die Frage anhand der nummerierten Quellen. Quellen vom Typ „Bedienhilfe" ` +
    `erklären, wie das Portal bedient wird – nutze sie für Fragen zur Nutzung („wie/wo mache ich …"). ` +
    `Steht die Antwort weder in den Inhalten noch in der Bedienhilfe, sage wörtlich: ` +
    `"Dazu finde ich in Ihren Unterlagen nichts." Erfinde nichts, spekuliere nicht. ` +
    `Antworte knapp und sachlich auf Deutsch. ` +
    `Gib in "used" die Nummern der tatsächlich genutzten Quellen an (leer, wenn keine passt).\n\n` +
    `QUELLEN:\n${context}\n\nFRAGE: ${q}`;

  const key = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                answer: { type: "string" },
                used: { type: "array", items: { type: "integer" } },
              },
              required: ["answer", "used"],
            },
          },
        }),
      },
    ).finally(() => clearTimeout(timer));

    if (!res.ok) return { answer: "Der Assistent ist momentan nicht erreichbar.", sources: [] };
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { answer: "Der Assistent ist momentan nicht erreichbar.", sources: [] };

    const parsed = JSON.parse(text) as { answer?: string; used?: number[] };
    const answer = (parsed.answer ?? "").trim() || "Dazu finde ich in Ihren Unterlagen nichts.";
    const used = Array.isArray(parsed.used) ? parsed.used : [];
    const cited = used
      .map((n) => sources[n - 1])
      .filter((s): s is AssistantSource => Boolean(s));
    // Bei „nichts gefunden" keine Quellen zeigen; sonst genutzte (oder – als
    // Fallback – die Top-Quellen, falls das Modell keine Nummern lieferte).
    const noHit = /finde ich in ihren unterlagen nichts/i.test(answer);
    const shown = noHit ? [] : cited.length > 0 ? cited : sources.slice(0, 3);
    return { answer, sources: dedupe(shown) };
  } catch {
    return { answer: "Der Assistent ist momentan nicht erreichbar.", sources: [] };
  }
}

function dedupe(sources: AssistantSource[]): AssistantSource[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const k = `${s.type}|${s.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
