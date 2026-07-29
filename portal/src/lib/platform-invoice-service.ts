// Gemeinsame Dienste rund um Plattform-Rechnungen: PDF bauen und per E-Mail
// versenden. Wird von der PDF-Route, dem Mailversand und dem Mahnwesen genutzt,
// damit die Assembly nur an einer Stelle lebt.
import { db } from "@/lib/db";
import path from "node:path";
import { renderPlatformInvoicePdf } from "@/lib/documents/platform-invoice";
import { formatInvoiceNumber, platformIssuer } from "@/lib/platform";
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
    // Der Betreiber tritt hier als Absender auf, nicht ein Mandant — deshalb
    // das feste Logo aus public/ und nicht das Branding der Organisation.
    logo: path.join(process.cwd(), "public", "bw-logo.png"),
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

export type InvoiceMailResult = "sent" | "no_recipient" | "mail_disabled";

// Versendet die Rechnung als PDF-Anhang mit dem angegebenen Betreff/Text an den
// Kunden. Nutzt bewusst DEFAULT_BRANDING (B&W ist Aussteller, nicht der Mandant).
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
  await sendMail(to, subject, text, [attachment]);
  return "sent";
}
