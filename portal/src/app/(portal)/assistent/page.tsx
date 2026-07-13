import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { canUseAssistant, isAssistantEnabled } from "@/lib/assistant";
import { requireUser } from "@/lib/session";
import { AssistantChat } from "./AssistantChat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireUser();
  // Serverseitiger Schutz: ohne Freigabe/Rolle gar nicht erreichbar.
  if (!isAssistantEnabled() || !canUseAssistant(user)) redirect("/dashboard");

  return (
    <>
      <PageTitle>Assistent</PageTitle>
      <AssistantChat />
    </>
  );
}
