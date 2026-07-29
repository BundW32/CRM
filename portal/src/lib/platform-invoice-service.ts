// Gemeinsame Dienste rund um Plattform-Rechnungen: PDF bauen und per E-Mail
// versenden. Wird von der PDF-Route, dem Mailversand und dem Mahnwesen genutzt,
// damit die Assembly nur an einer Stelle lebt.
import { db } from "@/lib/db";
import { renderPlatformInvoicePdf } from "@/lib/documents/platform-invoice";
import { formatInvoiceNumber, platformBranding, platformIssuer } from "@/lib/platform";
import { MailAttachment, isMailEnabled, sendMail } from "@/lib/mailer";

// Lädt eine Rechnung mit allem, was für PDF/Mail nötig ist.
export async function loadInvoiceForPdf(id: string) {
  return db.platformInvoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      organization: {
        select: { name: true, legalName: true, street: true, zip: true, city: true, email: true },
      },
    },
  });
}

type LoadedInvoice = NonNullable<Awaited<ReturnType<typeof loadInvoiceForPdf>>>;

// Baut das Rechnungs-PDF aus einem geladenen Datensatz.
export async function buildInvoicePdf(invoice: LoadedInvoice): Promise<Buffer> {
  return renderPlatformInvoicePdf({
    year: invoice.year,
    number: invoice.number,
    title: invoice.title,
    status: invoice.status,
    vatRate: invoice.vatRate,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    createdAt: invoice.createdAt,
    recipient: invoice.organization,
    items: invoice.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
    })),
    issuer: platformIssuer(),
  });
}

// Ermittelt die Empfänger-E-Mail einer Verwaltung: Rechnungs-/Kontakt-E-Mail der
// Org, sonst der primäre aktive SuperAdmin.
export async function invoiceRecipientEmail(
  organizationId: string,
  orgEmail: string | null | undefined,
): Promise<string | null> {
  if (orgEmail) return orgEmail;
  const admin = await db.user.findFirst({
    where: { organizationId, isSuperAdmin: true, active: true, email: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  return admin?.email ?? null;
}

export type InvoiceMailResult = "sent" | "no_recipient" | "mail_disabled" | "failed";

// Versendet die Rechnung als PDF-Anhang mit dem angegebenen Betreff/Text an den
// Kunden. Nutzt bewusst das Betreiber-Branding (die Plattform ist Aussteller,
// nicht der Mandant).
export async function mailInvoicePdf(
  invoice: LoadedInvoice,
  subject: string,
  text: string,
): Promise<InvoiceMailResult> {
  if (!isMailEnabled()) return "mail_disabled";
  const to = await invoiceRecipientEmail(invoice.organizationId, invoice.organization.email);
  if (!to) return "no_recipient";

  const pdf = await buildInvoicePdf(invoice);
  const attachment: MailAttachment = {
    filename: `Rechnung_${formatInvoiceNumber(invoice.year, invoice.number)}.pdf`,
    content: pdf,
    contentType: "application/pdf",
  };
  // Ein Fehlschlag beim Versand galt bisher trotzdem als „sent" – die Rechnung
  // bekam ein Versanddatum und galt als zugestellt, obwohl nichts rausging.
  const outcome = await sendMail(to, subject, text, [attachment], platformBranding());
  if (outcome === "sent") return "sent";
  return outcome === "disabled" ? "mail_disabled" : "failed";
}
