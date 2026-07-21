import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { MarketingLanding } from "@/components/marketing-landing";

export default async function Home() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return <MarketingLanding />;
}
