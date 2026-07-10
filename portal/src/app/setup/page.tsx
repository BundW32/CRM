import { redirect } from "next/navigation";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { BwLogo } from "@/components/logo";
import { db } from "@/lib/db";
import { createFirstAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const userCount = await db.user.count();
  if (userCount > 0) redirect("/login");
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <BwLogo className="mx-auto mb-1 h-20 w-auto" />
          <p className="mb-6 text-center text-sm font-medium text-gray-400">
            Ersteinrichtung
          </p>
          <h1 className="mb-2 text-lg font-semibold">Verwalter-Zugang anlegen</h1>
          <p className="mb-4 text-sm text-gray-600">
            Das Portal hat noch keine Nutzer. Legen Sie jetzt den ersten
            Verwalter-Zugang an — danach verwalten Sie alles im Portal.
          </p>
          {fehler ? (
            <Alert variant="error" className="mb-4">
              Bitte alle Felder ausfüllen (Passwort mind. 10 Zeichen).
            </Alert>
          ) : null}
          <form action={createFirstAdmin} className="space-y-4">
            <Field label="Name">
              <input type="text" name="name" required minLength={2} className={inputClass} />
            </Field>
            <Field label="E-Mail-Adresse">
              <input type="email" name="email" required autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Passwort (mind. 10 Zeichen)">
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <button type="submit" className={`${buttonClass} w-full`}>
              Zugang anlegen
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
