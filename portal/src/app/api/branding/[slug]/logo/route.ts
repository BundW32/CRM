import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Öffentliche Logo-Auslieferung pro Mandant (Slug). Logos sind reine
// Branding-Assets ohne Personenbezug und müssen auch in unauthentifizierten
// Kontexten (E-Mails, Login-Seite) abrufbar sein.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const org = await db.organization.findUnique({
    where: { slug },
    select: { logoStoredName: true },
  });
  if (!org?.logoStoredName) {
    return NextResponse.json({ error: "Kein Logo" }, { status: 404 });
  }

  const stored = org.logoStoredName;
  const cacheControl = "public, max-age=300";

  try {
    // Vercel Blob (https://) – Bearer-Token für private Blobs serverseitig.
    if (stored.startsWith("https://")) {
      const headers: Record<string, string> = {};
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const upstream = await fetch(stored, { headers });
      if (!upstream.ok) {
        return NextResponse.json({ error: "Logo nicht abrufbar" }, { status: 404 });
      }
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "image/png",
          "Cache-Control": cacheControl,
        },
      });
    }

    const data = await readUpload(stored);
    // Content-Type grob aus Data-URL/Endung ableiten, sonst PNG.
    let contentType = "image/png";
    if (stored.startsWith("data:")) {
      const m = stored.match(/^data:([^;,]+)/);
      if (m) contentType = m[1];
    } else if (/\.jpe?g$/i.test(stored)) {
      contentType = "image/jpeg";
    } else if (/\.webp$/i.test(stored)) {
      contentType = "image/webp";
    }
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": contentType, "Cache-Control": cacheControl },
    });
  } catch {
    return NextResponse.json({ error: "Logo nicht lesbar" }, { status: 404 });
  }
}
