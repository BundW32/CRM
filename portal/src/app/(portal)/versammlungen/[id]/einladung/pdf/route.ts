import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { generateMeetingInvitation } from "@/lib/documents/meeting-invitation";

export const dynamic = "force-dynamic";

// Einladung zur Eigentümerversammlung als druckfertiger DIN-A4-Brief
// (Fensterumschlag). Optional je Empfänger über ?owner=<userId>. Verwalter im
// Objekt-Scope; ohne owner ein neutraler Vorlagendruck („An alle Eigentümer").
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const verwalter = await requireVerwalter();
  const { id } = await params;

  const meeting = await db.ownersMeeting.findFirst({
    where: { id, organizationId: verwalter.organizationId },
    include: {
      property: { select: { id: true, name: true, city: true, organizationId: true } },
      agendaItems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!(await canVerwalterAccessProperty(verwalter, meeting.propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  // Optionaler Empfänger: nur ein Eigentümer DIESES Objekts ist zulässig.
  let recipientName: string | null = null;
  let recipientAddress: string | null = null;
  const ownerId = new URL(request.url).searchParams.get("owner");
  if (ownerId) {
    const ownership = await db.ownership.findFirst({
      where: { propertyId: meeting.propertyId, userId: ownerId },
      select: { user: { select: { name: true, street: true, zip: true, city: true } } },
    });
    if (!ownership) return NextResponse.json({ error: "Empfänger nicht gefunden" }, { status: 404 });
    const u = ownership.user;
    recipientName = u.name;
    recipientAddress =
      u.street && u.zip && u.city ? `${u.street}\n${u.zip} ${u.city}` : null;
  }

  try {
    const branding = await getBrandingForOrg(meeting.property.organizationId);
    const pdf = await generateMeetingInvitation({
      issuer: {
        legalName: branding.legalName,
        contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
      },
      propertyName: meeting.property.name,
      meetingTitle: meeting.title,
      scheduledAt: meeting.scheduledAt,
      location: meeting.location,
      videoLink: meeting.videoLink,
      agenda: meeting.agendaItems.map((it, i) => ({
        index: i + 1,
        title: it.title,
        description: it.description,
        type: it.type as "INFO" | "BESCHLUSS",
      })),
      recipientName,
      recipientAddress,
      city: branding.city ?? meeting.property.city ?? null,
      createdAt: new Date(),
    });

    const suffix = recipientName ? recipientName.replace(/[^a-zA-Z0-9]/g, "_") : "alle";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Einladung_${suffix}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Einladungs-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
