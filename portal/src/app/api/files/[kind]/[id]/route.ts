import { NextResponse } from "next/server";
import {
  canVerwalterAccessHandover,
  canVerwalterAccessProperty,
  canViewProperty,
  canViewTicket,
  documentWhereForUser,
  ownsProperty,
} from "@/lib/access";
import { get } from "@vercel/blob";
import { db } from "@/lib/db";
import { contentDisposition, wantsDownload } from "@/lib/documents/pdf-response";
import { isBlobUrl, readUpload } from "@/lib/storage";
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
  } else if (kind === "freistellung" && user?.role === "VERWALTER") {
    // Freistellungsbescheinigung nach § 48b EStG. Nur Verwalter der eigenen
    // Organisation — die Bescheinigung enthält Steuernummer und Anschrift des
    // Betriebs und geht Eigentümer und Mieter nichts an.
    const handwerker = await db.craftsman.findUnique({
      where: { id },
      select: {
        organizationId: true,
        exemptionStoredName: true,
        exemptionFileName: true,
        exemptionMimeType: true,
      },
    });
    if (handwerker?.exemptionStoredName && handwerker.organizationId === user.organizationId) {
      file = {
        storedName: handwerker.exemptionStoredName,
        fileName: handwerker.exemptionFileName ?? `freistellungsbescheinigung-${id}.pdf`,
        mimeType: handwerker.exemptionMimeType ?? "application/pdf",
      };
    }
  } else if (kind === "rechnung") {
    // Handwerker-Rechnung (M-L): Verwalter im Ticket-Scope ODER der Handwerker,
    // der die Rechnung eingereicht hat (Magic-Link).
    const invoice = await db.craftsmanInvoice.findUnique({
      where: { id },
      include: { ticket: true },
    });
    if (invoice) {
      if (user && (await canViewTicket(user, invoice.ticket))) {
        file = invoice;
      } else if (craftsman && invoice.craftsmanId === craftsman.id) {
        file = invoice;
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
  } else if (kind === "property-image" && user) {
    // Titelbild eines Objekts – sichtbar für Verwalter im Scope sowie Eigentümer
    // und aktuelle Mieter des Objekts (org- und zugriffsgesichert).
    const prop = await db.property.findUnique({
      where: { id },
      select: { organizationId: true, titleImageStoredName: true },
    });
    if (
      prop?.titleImageStoredName &&
      prop.organizationId === user.organizationId &&
      (await canViewProperty(user, id))
    ) {
      file = {
        storedName: prop.titleImageStoredName,
        fileName: `objekt-${id}.jpg`,
        mimeType: "image/jpeg",
      };
    }
  } else if (kind === "mietvertrag" && user) {
    // Mietvertrag: Verwalter im Objekt-Scope ODER der Mieter selbst.
    const tenancy = await db.tenancy.findUnique({
      where: { id },
      select: {
        userId: true,
        contractStoredName: true,
        contractFileName: true,
        contractMimeType: true,
        unit: { select: { propertyId: true, property: { select: { organizationId: true } } } },
      },
    });
    if (tenancy?.contractStoredName && tenancy.unit.property.organizationId === user.organizationId) {
      const allowed =
        user.id === tenancy.userId ||
        (user.role === "VERWALTER" && (await canVerwalterAccessProperty(user, tenancy.unit.propertyId)));
      if (allowed) {
        file = {
          storedName: tenancy.contractStoredName,
          fileName: tenancy.contractFileName ?? `mietvertrag-${id}.pdf`,
          mimeType: tenancy.contractMimeType ?? "application/pdf",
        };
      }
    }
  } else if (kind === "vote-proof" && user?.role === "VERWALTER") {
    // Nachweis einer stellvertretend eingetragenen Stimme – nur für den Verwalter
    // im Objekt-Scope (enthält die schriftliche Stimme eines Eigentümers).
    const vote = await db.resolutionVote.findUnique({
      where: { id },
      include: { resolution: { select: { organizationId: true, propertyId: true } } },
    });
    if (
      vote?.proofStoredName &&
      vote.resolution.organizationId === user.organizationId &&
      (await canVerwalterAccessProperty(user, vote.resolution.propertyId))
    ) {
      file = {
        storedName: vote.proofStoredName,
        fileName: vote.proofFileName ?? `nachweis-${id}`,
        mimeType: vote.proofMimeType ?? "application/octet-stream",
      };
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
  // Wichtig für mobile Browser und für die installierte PWA (display=standalone),
  // die ein PDF sonst in einem Vollbild-Betrachter ohne Rückweg öffnen – als
  // Download übernimmt es der PDF-Betrachter des Geräts.
  // Aufbau der Kopfzeile (ASCII-Fallback + RFC-5987) liegt in
  // lib/documents/pdf-response.ts, damit die Generator-Routen exakt dasselbe tun.
  const disposition = contentDisposition(file.fileName, wantsDownload(request));
  const cacheControl = "private, max-age=300";

  try {
    if (file.storedName.startsWith("https://")) {
      // Teilbereichs-Anfragen (z. B. Video-Streaming) deckt das SDK nicht ab –
      // dafür die private Blob-URL direkt mit Bearer-Token weiterleiten.
      if (rangeHeader) {
        // Host prüfen, BEVOR das Zugriffs-Token mitgeschickt wird – sonst
        // erhielte ein fremder Server das Lese- und Schreibrecht auf sämtliche
        // Kundendateien. Dieselbe Prüfung wie in storage.ts/readUpload.
        if (!isBlobUrl(file.storedName)) {
          return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 404 });
        }
        const blobHeaders: Record<string, string> = { Range: rangeHeader };
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (blobToken) blobHeaders["Authorization"] = `Bearer ${blobToken}`;
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

      // Standardfall (Bilder, PDFs): private Blobs offiziell über das SDK
      // ausliefern – authentifiziert automatisch per OIDC bzw. Token.
      const result = await get(file.storedName, { access: "private" });
      if (!result || result.statusCode !== 200) {
        return NextResponse.json({ error: "Datei nicht abrufbar" }, { status: 404 });
      }
      return new NextResponse(result.stream, {
        headers: {
          "Content-Type": file.mimeType,
          "Content-Disposition": disposition,
          "Cache-Control": cacheControl,
          "Accept-Ranges": "bytes",
        },
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
