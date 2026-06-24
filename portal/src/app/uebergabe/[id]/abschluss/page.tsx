import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import { StepHeader } from "@/app/uebergabe/_components/StepHeader";
import { generateHandoverPdf, sendHandoverEmail } from "./actions";

export const dynamic = "force-dynamic";

const typeLabels = { EINZUG: "Einzug", AUSZUG: "Auszug", ZWISCHENZUSTAND: "Zwischenzustand" };

export default async function AbschlussPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  await requireVerwalter();
  const { id } = await params;
  const { sent } = await searchParams;

  const handover = await db.handover.findUnique({
    where: { id },
    include: { unit: { include: { property: true } } },
  });
  if (!handover) notFound();

  const dateFormatted = handover.handoverDate.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const pdfUrl = handover.pdfStoredName ? `/api/files/handover-pdf/${id}` : null;

  // Collect all available email addresses
  const emails: { label: string; email: string }[] = [];
  if (handover.tenantEmail) emails.push({ label: `Mieter (${handover.tenantName ?? handover.tenantEmail})`, email: handover.tenantEmail });
  if (handover.ownerEmail) emails.push({ label: `Eigentümer (${handover.ownerName ?? handover.ownerEmail})`, email: handover.ownerEmail });
  if (handover.managerEmail) emails.push({ label: `Verwalter (${handover.managerName ?? handover.managerEmail})`, email: handover.managerEmail });

  const defaultEmailBody = `Sehr geehrte Damen und Herren,

anbei erhalten Sie das Übergabeprotokoll für die Wohnung ${handover.unit.label} im Objekt ${handover.unit.property.name} vom ${dateFormatted}.

Mit freundlichen Grüßen
${handover.managerName ?? ""}`.trim();

  return (
    <div className="pb-10 animate-page-in">
      <StepHeader currentStep={6} title="Abschluss" backHref={`/uebergabe/${id}/unterschriften`} handoverId={id} />

      <div className="mx-auto max-w-2xl px-4 pt-6 space-y-5">
        {/* Success banner */}
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-green-800">Protokoll abgeschlossen!</p>
              <p className="text-sm text-green-700 mt-0.5">
                {typeLabels[handover.type]} · {handover.unit.property.name} · {handover.unit.label} · {dateFormatted}
              </p>
              {handover.tenantName && (
                <p className="text-sm text-green-700">Mieter: {handover.tenantName}</p>
              )}
            </div>
          </div>
        </div>

        {/* PDF section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">PDF-Protokoll</h2>

          {pdfUrl ? (
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href={`${pdfUrl}?download=1`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass}
              >
                <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                PDF herunterladen
              </a>
              <form action={generateHandoverPdf.bind(null, id)}>
                <button type="submit" className={buttonSecondaryClass}>
                  PDF neu generieren
                </button>
              </form>
            </div>
          ) : (
            <form action={generateHandoverPdf.bind(null, id)}>
              <button type="submit" className={buttonClass}>
                <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF generieren
              </button>
            </form>
          )}
        </div>

        {/* Email section */}
        {emails.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900">Protokoll per E-Mail versenden</h2>

            {sent && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                ✓ Protokoll an {sent} Empfänger gesendet.
              </div>
            )}

            <form action={sendHandoverEmail} className="space-y-4">
              <input type="hidden" name="handoverId" value={id} />

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Empfänger</p>
                <div className="space-y-2">
                  {emails.map((e) => (
                    <label key={e.email} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailTo"
                        value={e.email}
                        defaultChecked
                        className="accent-brand-orange"
                      />
                      <span className="text-sm text-gray-700">{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail-Text</label>
                <textarea
                  name="emailBody"
                  defaultValue={defaultEmailBody}
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/30 resize-none"
                />
              </div>

              <button type="submit" className={buttonClass}>
                <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                E-Mail senden
              </button>
            </form>
          </div>
        )}

        {/* Back to overview */}
        <div className="flex justify-center pt-4">
          <a href="/verwaltung" className={buttonSecondaryClass}>
            Zurück zur Verwaltung
          </a>
        </div>
      </div>
    </div>
  );
}
