import { redirect } from "next/navigation";
import { Field, buttonClass, inputClass } from "@/components/ui";
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
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-blue-900">
            B&amp;W Immobilien Management
          </p>
          <p className="mt-1 text-sm text-gray-500">Kundenportal · Ersteinrichtung</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Verwalter-Zugang anlegen</h1>
          <p className="mb-4 text-sm text-gray-600">
            Das Portal hat noch keine Nutzer. Legen Sie jetzt den ersten
            Verwalter-Zugang an — danach verwalten Sie alles im Portal.
          </p>
          {fehler ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Bitte alle Felder ausfüllen (Passwort mind. 10 Zeichen).
            </p>
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
