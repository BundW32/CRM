import Link from "next/link";
import { Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";
import { createInvoice } from "../actions";
import { InvoiceItemsField } from "./InvoiceItemsField";

export const dynamic = "force-dynamic";

const errorText: Record<string, string> = {
  eingabe: "Bitte Verwaltung und Titel angeben.",
  betrag: "Ungültiger Betrag in einer Position.",
  positionen: "Mindestens eine Position mit Beschreibung ist nötig.",
};

export default async function NeueRechnungPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; fehler?: string }>;
}) {
  await requirePlatformAdmin();
  const sp = await searchParams;

  const orgs = await db.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <PageTitle
        action={
          <Link href="/plattform/rechnungen" className={buttonSecondaryClass}>
            ← Rechnungen
          </Link>
        }
      >
        Neue Rechnung
      </PageTitle>

      {sp.fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorText[sp.fehler] ?? "Eingabe prüfen."}
        </p>
      ) : null}

      <Card>
        <form action={createInvoice} className="space-y-4">
          <Field label="Verwaltung">
            <select name="organizationId" required defaultValue={sp.org ?? ""} className={inputClass}>
              <option value="" disabled>– Verwaltung wählen –</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Titel / Betreff">
            <input type="text" name="title" required maxLength={200} placeholder="z. B. CRM-Nutzung Juli 2026" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="USt-Satz (%)">
              <input type="number" name="vatRate" min={0} max={100} defaultValue={19} className={inputClass} />
            </Field>
            <Field label="Fällig bis (optional)">
              <input type="date" name="dueAt" className={inputClass} />
            </Field>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Positionen</span>
            <InvoiceItemsField />
          </div>
          <button type="submit" className={buttonClass}>Rechnung anlegen (Entwurf)</button>
          <p className="text-xs text-gray-400">
            Die Rechnung wird als Entwurf mit fortlaufender Nummer angelegt. Erst beim
            Übergang auf den Status „Offen“ gilt sie als gestellt.
          </p>
        </form>
      </Card>
    </>
  );
}
