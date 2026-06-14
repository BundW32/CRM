import { NextResponse } from "next/server";
import { canViewTicket, documentWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const user = await getUser();
  const token = new URL(request.url).searchParams.get("token");

  // Handwerker ohne Login: Zugriff per Magic-Link-Token auf Anhänge ihrer Aufträge
  let craftsman = null;
  if (!user && token) {
    const found = await db.craftsman.findUnique({ where: { accessToken: token } });
    if (found && found.active) craftsman = found;
  }

  if (!user && !craftsman) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { kind, id } = await params;

  let file: { storedName: string; fileName: string; mimeType: string } | null = null;

  if (kind === "anhang") {
    const attachment = await db.attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });
    if (attachment) {
      if (user && (await canViewTicket(user, attachment.ticket))) {
        file = attachment;
      } else if (craftsman && attachment.ticket.craftsmanId === craftsman.id) {
        file = attachment;
      }
    }
  } else if (kind === "dokument" && user) {
    const document = await db.document.findFirst({
      where: { id, AND: await documentWhereForUser(user) },
    });
    if (document) file = document;
  }

  if (!file) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  try {
    const data = await readUpload(file.storedName);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Datei nicht lesbar" }, { status: 404 });
  }
}
