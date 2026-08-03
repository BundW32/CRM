import { NextResponse } from "next/server";
import { AUDIT, logAudit } from "@/lib/audit";
import { isPlatformAdminUser, formatInvoiceNumber } from "@/lib/platform";
import { buildInvoicePdf, loadInvoiceForPdf } from "@/lib/platform-invoice-service";
import { getUser } from "@/lib/session";
import { getClientIp } from "@/lib/rate-limit";
import { pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const { id } = await params;

  const invoice = await loadInvoiceForPdf(id);
  if (!invoice) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const pdf = await buildInvoicePdf(invoice);

    await logAudit({
      actorId: user.id,
      action: AUDIT.PLATFORM_INVOICE_DOWNLOADED,
      targetType: "PlatformInvoice",
      targetId: id,
      ip: await getClientIp(),
    });

    const fileName = `Rechnung_${formatInvoiceNumber(invoice.year, invoice.number)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Rechnungs-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "PDF fehlgeschlagen" }, { status: 500 });
  }
}
