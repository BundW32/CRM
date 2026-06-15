// Wendet die KI-Triage auf einen Vorgang an: setzt Gewerk (falls noch leer) und
// Priorität und hinterlegt eine interne Notiz mit der Zusammenfassung.
import { classifyTicket, type TriageResult } from "./ai";
import { db } from "./db";
import { tradeLabels } from "./labels";

export async function applyTriage(
  ticketId: string,
  content: { title: string; description: string }
): Promise<TriageResult | null> {
  const ai = await classifyTicket(content);
  if (!ai) return null;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { trade: true },
  });
  if (!ticket) return null;

  // Gewerk nur setzen, wenn noch keines hinterlegt ist (Wahl des Melders hat Vorrang)
  const setTrade = ticket.trade == null ? ai.trade ?? undefined : undefined;

  await db.ticket.update({
    where: { id: ticketId },
    data: { ...(setTrade ? { trade: setTrade } : {}), priority: ai.priority },
  });

  await db.ticketComment.create({
    data: {
      ticketId,
      internal: true,
      body:
        `KI-Triage: ${ai.summary}` +
        (ai.trade ? ` · Gewerk: ${tradeLabels[ai.trade]}` : "") +
        ` · Priorität: ${ai.priority}`,
    },
  });

  return ai;
}
