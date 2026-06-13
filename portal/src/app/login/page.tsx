import { redirect } from "next/navigation";
import { buttonClass, inputClass, Field } from "@/components/ui";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  if ((await db.user.count()) === 0) redirect("/setup");
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-blue-900">
            B&amp;W Immobilien Management
          </p>
          <p className="mt-1 text-sm text-gray-500">Kundenportal</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold">Anmelden</h1>
          {fehler ? (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              E-Mail-Adresse oder Passwort ist falsch.
            </p>
          ) : null}
          <form action={login} className="space-y-4">
            <Field label="E-Mail-Adresse">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className={inputClass}
              />
            </Field>
            <Field label="Passwort">
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
            <button type="submit" className={`${buttonClass} w-full`}>
              Anmelden
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <a href="/login/forgot" className="text-blue-700 hover:underline text-sm">
              Passwort vergessen?
            </a>
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Noch keinen Zugang? Ihre Zugangsdaten erhalten Sie von der B&amp;W
            Immobilien Management UG: info@bundwimmobilien.de
          </p>
        </div>
      </div>
    </main>
  );
}
