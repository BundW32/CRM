import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AUDIT, logAudit } from "@/lib/audit";
import { isPlatformAdminUser, platformIssuer, formatInvoiceNumber } from "@/lib/platform";
import { getUser } from "@/lib/session";
import { getClientIp } from "@/lib/rate-limit";
import { renderPlatformInvoicePdf } from "@/lib/documents/platform-invoice";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user || !isPlatformAdminUser(user)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const { id } = await params;

  const invoice = await db.platformInvoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      organization: { select: { name: true, legalName: true, street: true, zip: true, city: true } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const pdf = await renderPlatformInvoicePdf({
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

    await logAudit({
      actorId: user.id,
      action: AUDIT.PLATFORM_INVOICE_DOWNLOADED,
      targetType: "PlatformInvoice",
      targetId: id,
      ip: await getClientIp(),
    });

    const fileName = `Rechnung_${formatInvoiceNumber(invoice.year, invoice.number)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Rechnungs-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "PDF fehlgeschlagen" }, { status: 500 });
  }
}
