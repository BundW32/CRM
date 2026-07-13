"use server";

import { askAssistant, canUseAssistant, isAssistantEnabled, type AssistantResult } from "@/lib/assistant";
import { requireUser } from "@/lib/session";

export type AskState = AssistantResult & { question: string };

// Server Action für den Chat. Prüft Feature-Flag und Rolle serverseitig; die
// Rechte-Filterung passiert in askAssistant über die access.ts-Helfer.
export async function ask(_prev: AskState | null, formData: FormData): Promise<AskState> {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim();

  if (!isAssistantEnabled() || !canUseAssistant(user)) {
    return { question, answer: "Der Assistent ist derzeit nicht verfügbar.", sources: [] };
  }
  if (!question) {
    return { question, answer: "Bitte stellen Sie eine Frage.", sources: [] };
  }

  const result = await askAssistant(user, question);
  return { question, ...result };
}
