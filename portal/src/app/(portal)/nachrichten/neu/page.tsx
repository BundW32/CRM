// Neue Nachricht in zwei Schritten – wie in einem Chat-Programm.
//
// Schritt 1: Empfänger wählen. Schritt 2: Man steht in einem noch leeren Verlauf,
// mit dem Namen des Gegenübers oben und dem Eingabefeld unten.
//
// Der Verlauf entsteht erst beim Senden, nicht schon beim Öffnen. Andernfalls
// bliebe jeder abgebrochene Versuch als leerer Verlauf in der Liste stehen – und
// der Empfänger sähe einen Eintrag, zu dem ihm nie jemand etwas geschrieben hat.
//
// Der Betreff bleibt, sitzt aber im Verlauf statt in einem Formular davor: Er
// steht in der Benachrichtigungs-E-Mail („Neue Nachricht: …") und ist in der
// Liste das, was zwei Verläufe mit derselben Person unterscheidbar macht.

import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";
import {
  Alert,
  Card,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { canVerwalterManageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { startConversation } from "../actions";
import { EmpfaengerSelect } from "../EmpfaengerSelect";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte Betreff und Nachricht ausfüllen.",
  empfaenger: "Bitte einen gültigen Empfänger wählen.",
};

export default async function NeueNachrichtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const fehler = typeof sp.fehler === "string" ? sp.fehler : undefined;
  const isVerwalter = user.role === "VERWALTER";

  // Empfänger aus der URL – mehrere möglich (Sammel-Nachricht).
  const roh = sp.recipientId;
  const gewaehlt = [...new Set((Array.isArray(roh) ? roh : roh ? [roh] : []).filter(Boolean))];

  // Jede Id einzeln gegen die Zugriffsgrenzen prüfen, bevor auch nur ein Name
  // angezeigt wird – die Ids stehen in der URL und sind damit frei wählbar.
  const empfaenger: { id: string; name: string }[] = [];
  if (isVerwalter) {
    for (const id of gewaehlt) {
      if (id === user.id) continue;
      const person = await db.user.findUnique({
        where: { id },
        select: { id: true, name: true, role: true, active: true },
      });
      if (!person || !person.active || person.role === "VERWALTER") continue;
      if (!(await canVerwalterManageUser(user, person.id))) continue;
      empfaenger.push({ id: person.id, name: person.name });
    }
  }

  // ── Schritt 1: Empfänger wählen ───────────────────────────────────────────
  // Mieter und Eigentümer überspringen ihn: Ihr Gegenüber ist immer die
  // Verwaltung, da gibt es nichts zu wählen.
  if (isVerwalter && empfaenger.length === 0) {
    return (
      <>
        <PageTitle back={{ href: "/nachrichten", label: "Nachrichten" }}>
          Neue Nachricht
        </PageTitle>

        {fehler ? (
          <Alert variant="error" className="mb-4">
            {errorMessages[fehler] ?? "Bitte Eingaben prüfen."}
          </Alert>
        ) : null}

        <div className="max-w-2xl">
          <Card title="An wen?">
            {/* GET auf dieselbe Seite: Die gewählten Ids landen in der URL und
                führen zu Schritt 2 – ohne Zwischenspeicher und ohne Client-JS. */}
            <form method="get" action="/nachrichten/neu" className="space-y-3">
              <EmpfaengerSelect />
              <button type="submit" className={buttonClass}>
                Weiter
              </button>
            </form>
          </Card>
        </div>
      </>
    );
  }

  // ── Schritt 2: der noch leere Verlauf ─────────────────────────────────────
  const mit = isVerwalter ? empfaenger.map((e) => e.name).join(", ") : "Verwaltung";

  return (
    <>
      <PageTitle back={{ href: "/nachrichten", label: "Nachrichten" }}>
        {isVerwalter ? "Neue Nachricht" : "Nachricht an die Verwaltung"}
      </PageTitle>
      <p className="mb-4 text-sm text-gray-300">
        Mit: {mit}
        {isVerwalter && empfaenger.length > 1
          ? ` · ${empfaenger.length} eigene Verläufe, die Empfänger sehen sich nicht gegenseitig`
          : ""}
        {isVerwalter ? (
          <>
            {" · "}
            <Link href="/nachrichten/neu" className="underline hover:text-brand-orange">
              ändern
            </Link>
          </>
        ) : null}
      </p>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          {errorMessages[fehler] ?? "Bitte Eingaben prüfen."}
        </Alert>
      ) : null}

      <Card>
        <form action={startConversation} className="space-y-4">
          {empfaenger.map((e) => (
            <input key={e.id} type="hidden" name="recipientId" value={e.id} />
          ))}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Betreff</span>
            <input
              type="text"
              name="subject"
              required
              minLength={2}
              maxLength={200}
              placeholder="Worum geht es?"
              className={inputClass}
            />
          </label>

          {/* Leerer Verlauf – macht sichtbar, dass hier gleich ein Gespräch steht
              und nicht ein Formular abgeschickt wird. */}
          <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            Noch keine Nachrichten. Schreiben Sie die erste.
          </div>

          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="sr-only">Nachricht</span>
              <textarea
                name="body"
                required
                minLength={1}
                maxLength={5000}
                rows={3}
                placeholder="Nachricht schreiben …"
                className={inputClass}
              />
            </label>
            <SubmitButton pendingLabel="Wird gesendet…">Senden</SubmitButton>
          </div>
        </form>
      </Card>

      {isVerwalter ? (
        <p className="mt-3">
          <Link href="/nachrichten" className={buttonSecondaryClass}>
            Abbrechen
          </Link>
        </p>
      ) : null}
    </>
  );
}
