import { NextResponse } from "next/server";
import {
  canVerwalterAccessHandover,
  canVerwalterAccessProperty,
  canViewTicket,
  documentWhereForUser,
  ownsProperty,
} from "@/lib/access";
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
  } else if (kind === "handover-photo" && user?.role === "VERWALTER") {
    const photo = await db.handoverPhoto.findUnique({ where: { id } });
    // Scope-Prüfung: nur Protokolle der eigenen Objekte (verhindert IDOR)
    if (photo && (await canVerwalterAccessHandover(user, photo.handoverId))) file = photo;
  } else if (kind === "handover-meter" && user?.role === "VERWALTER") {
    const meter = await db.handoverMeter.findUnique({ where: { id } });
    if (meter?.photoStoredName && (await canVerwalterAccessHandover(user, meter.handoverId))) {
      file = { storedName: meter.photoStoredName, fileName: `zaehler-${id}.jpg`, mimeType: "image/jpeg" };
    }
  } else if (kind === "beleg" && (user?.role === "VERWALTER" || user?.role === "EIGENTUEMER")) {
    // Buchungsbeleg (WEG-Buchhaltung): Verwalter im Objekt-Scope ODER Eigentümer
    // des Objekts (Belegeinsicht). Immer IDOR-/Org-gesichert.
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        propertyId: true,
        organizationId: true,
        belegStoredName: true,
        belegFileName: true,
        belegMimeType: true,
      },
    });
    if (booking?.belegStoredName && booking.organizationId === user.organizationId) {
      const allowed =
        user.role === "VERWALTER"
          ? await canVerwalterAccessProperty(user, booking.propertyId)
          : await ownsProperty(user.id, booking.propertyId, user.organizationId);
      if (allowed) {
        file = {
          storedName: booking.belegStoredName,
          fileName: booking.belegFileName ?? `beleg-${id}.pdf`,
          mimeType: booking.belegMimeType ?? "application/pdf",
        };
      }
    }
  } else if (kind === "org-logo" && user) {
    // Logo der eigenen Organisation (Branding). Nur das Logo des eigenen
    // Mandanten wird ausgeliefert – Org-ID muss zur Session passen.
    if (id === user.organizationId) {
      const org = await db.organization.findUnique({
        where: { id },
        select: { logoStoredName: true },
      });
      if (org?.logoStoredName) {
        file = { storedName: org.logoStoredName, fileName: "logo.png", mimeType: "image/png" };
      }
    }
  } else if (kind === "handover-pdf" && user?.role === "VERWALTER") {
    const handover = await db.handover.findUnique({ where: { id } });
    if (handover?.pdfStoredName && (await canVerwalterAccessHandover(user, handover.id))) {
      file = { storedName: handover.pdfStoredName, fileName: `uebergabeprotokoll-${id}.pdf`, mimeType: "application/pdf" };
    }
  }

  if (!file) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  // ?download=1 erzwingt das Herunterladen (Content-Disposition: attachment).
  // Wichtig für mobile Browser, die ein PDF sonst nicht inline öffnen, sondern
  // nur eine leere Seite/„Link" zeigen – als Download lässt es sich überall
  // mit dem PDF-Betrachter des Geräts öffnen.
  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  // Content-Disposition mit ASCII-Fallback + RFC-5987-UTF-8-Variante.
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const utf8Name = encodeURIComponent(file.fileName);
  const dispositionType = forceDownload ? "attachment" : "inline";
  const disposition = `${dispositionType}; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
  const cacheControl = "private, max-age=300";

  try {
    // Vercel Blob: Range-Header direkt weiterleiten; Bearer-Token für private Blobs
    if (file.storedName.startsWith("https://")) {
      const blobHeaders: Record<string, string> = {};
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) blobHeaders["Authorization"] = `Bearer ${blobToken}`;
      if (rangeHeader) blobHeaders["Range"] = rangeHeader;
      const upstream = await fetch(file.storedName, { headers: blobHeaders });
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
