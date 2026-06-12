import { NextResponse } from "next/server";
import { canViewTicket, documentWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const { kind, id } = await params;

  let file: { storedName: string; fileName: string; mimeType: string } | null = null;

  if (kind === "anhang") {
    const attachment = await db.attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });
    if (attachment && (await canViewTicket(user, attachment.ticket))) {
      file = attachment;
    }
  } else if (kind === "dokument") {
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
