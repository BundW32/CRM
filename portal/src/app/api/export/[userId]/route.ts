import { NextResponse } from "next/server";
import { canVerwalterManageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// DSGVO-Datenexport (Art. 20). Nutzer dürfen nur ihre eigenen Daten exportieren,
// Verwalter die jedes Nutzers ("me" als Kürzel für die eigene Kennung).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const current = await getUser();
  if (!current) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { userId: raw } = await params;
  const userId = raw === "me" ? current.id : raw;

  // Fremddaten: nur Verwalter – und eingeschränkte Verwalter nur im eigenen Scope.
  if (userId !== current.id) {
    if (current.role !== "VERWALTER") {
      return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
    }
    if (!(await canVerwalterManageUser(current, userId))) {
      return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      phone: true,
      role: true,
      preferredContact: true,
      active: true,
      createdAt: true,
      tenancies: { include: { unit: { include: { property: true } } } },
      ownerships: { include: { property: true } },
      ticketsCreated: {
        select: { number: true, title: true, type: true, status: true, createdAt: true },
      },
      comments: { select: { body: true, createdAt: true, ticketId: true } },
      messagesSent: { select: { body: true, createdAt: true, conversationId: true } },
      resolutionVotes: { select: { choice: true, comment: true, createdAt: true, resolutionId: true } },
      meterReadings: { select: { value: true, readingDate: true, meterId: true } },
      acknowledgements: { select: { documentId: true, announcementId: true, createdAt: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const payload = {
    exportiertAm: new Date().toISOString(),
    hinweis:
      "Dieser Export enthält die zu Ihrer Person im B&W Kundenportal gespeicherten Daten (DSGVO Art. 20).",
    daten: user,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datenexport-${userId}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
