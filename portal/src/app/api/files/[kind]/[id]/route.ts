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

  const rangeHeader = request.headers.get("range");
  // Content-Disposition mit ASCII-Fallback + RFC-5987-UTF-8-Variante.
  // Wichtig für mobile Browser (iOS Safari), die PDFs sonst nicht inline öffnen.
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const utf8Name = encodeURIComponent(file.fileName);
  const disposition = `inline; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
  const cacheControl = "private, max-age=300";

  try {
    // Vercel Blob: Range-Header direkt an CDN weiterleiten (kein Buffer im Speicher)
    if (file.storedName.startsWith("https://")) {
      const upstream = await fetch(file.storedName, {
        headers: rangeHeader ? { Range: rangeHeader } : {},
      });
      if (!upstream.ok && upstream.status !== 206) {
        return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 404 });
      }
      const responseHeaders: Record<string, string> = {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
      };
      const cr = upstream.headers.get("Content-Range");
      const cl = upstream.headers.get("Content-Length");
      if (cr) responseHeaders["Content-Range"] = cr;
      if (cl) responseHeaders["Content-Length"] = cl;

      return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // Lokaler Speicher: Buffer einlesen und ggf. slicen
    const data = await readUpload(file.storedName);
    const totalSize = data.length;

    if (rangeHeader) {
      const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }
      const start = match[1] !== "" ? parseInt(match[1], 10) : totalSize - parseInt(match[2], 10);
      const end = match[2] !== "" ? parseInt(match[2], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }
      const clampedEnd = Math.min(end, totalSize - 1);
      const chunk = new Uint8Array(data.subarray(start, clampedEnd + 1));
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": disposition,
          "Cache-Control": cacheControl,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${clampedEnd}/${totalSize}`,
          "Content-Length": String(clampedEnd - start + 1),
        },
      });
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": cacheControl,
        "Accept-Ranges": "bytes",
        "Content-Length": String(totalSize),
      },
    });
  } catch {
    return NextResponse.json({ error: "Datei nicht lesbar" }, { status: 404 });
  }
}
