import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// „Infos" war früher eine Seite mit zwei Reitern. Beide sind jetzt eigenständige
// Menüpunkte. Diese Weiterleitung hält alte Links am Leben — sie stecken in bereits
// versendeten E-Mails, Push-Nachrichten und Lesezeichen.
export default async function InfosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const target = sp.t === "dokumente" ? "/dokumente" : "/aushaenge";

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "t") params.set(k, v);
  }
  const qs = params.toString();
  redirect(`${target}${qs ? `?${qs}` : ""}`);
}
