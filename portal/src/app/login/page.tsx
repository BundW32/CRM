import { redirect } from "next/navigation";
import { buttonClass, inputClass, Field } from "@/components/ui";
import { BwLogo } from "@/components/logo";
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
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <BwLogo className="mx-auto mb-1 h-20 w-auto" />
          <p className="mb-6 text-center text-sm font-medium text-gray-400">
            Kundenportal
          </p>
          <h1 className="mb-5 text-center text-lg font-semibold text-gray-800">
            Anmelden
          </h1>
          {fehler ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              Anmeldedaten oder Passwort sind falsch.
            </p>
          ) : null}
          <form action={login} className="space-y-4">
            <Field label="E-Mail-Adresse oder Benutzername">
              <input
                type="text"
                name="email"
                required
                autoComplete="username"
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
            <button type="submit" className={`${buttonClass} w-full py-2.5`}>
              Anmelden
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/login/forgot" className="text-sm text-brand-green hover:underline">
              Passwort vergessen?
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Noch keinen Zugang? Wenden Sie sich an{" "}
          <a href="mailto:info@bundwimmobilien.de" className="hover:underline">
            info@bundwimmobilien.de
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-gray-400">
          <a href="/impressum" className="hover:underline">
            Impressum
          </a>{" "}
          ·{" "}
          <a href="/datenschutz" className="hover:underline">
            Datenschutz
          </a>
        </p>
      </div>
    </main>
  );
}
