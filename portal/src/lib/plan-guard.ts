import { hatPlanFunktion, type PlanFunktion } from "./billing";
import { getOrganization } from "./session";

/**
 * Serverseitige Plan-Sperre für Server-Actions.
 *
 * Der Umfang je Tarif steht in PLAN_FUNKTIONEN (lib/billing.ts) — dieser
 * Helfer beantwortet nur, ob der Tarif der AKTUELLEN Organisation die
 * Funktion einschließt. Aufrufmuster in einer Action, direkt nach dem
 * Rollen-Wächter:
 *
 *   if (!(await planErlaubt("vollerUmfang"))) redirect("/…?flash=nur-mit-tarif");
 *
 * Die Sperre gehört in die Action, nicht (nur) ins Ausblenden eines Knopfs —
 * ein ausgeblendetes Formular ist keine Sperre (siehe Versammlungsbeschluss-
 * Regel in AGENTS.md). `src/lib/plan-sperre.test.ts` hält die Aufrufstellen
 * fest.
 */
export async function planErlaubt(funktion: PlanFunktion): Promise<boolean> {
  const org = await getOrganization();
  return Boolean(org && hatPlanFunktion(org, funktion));
}
