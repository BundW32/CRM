import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// CSV-Export der Eigentümerliste eines WEG-Objekts (Name, E-Mail, MEA, Anteil).
export async function GET(request: Request) {
  const user = await getUser();
  if (!user || user.role !== "VERWALTER") {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  }
  const propertyId = new URL(request.url).searchParams.get("objekt") ?? "";
  if (!propertyId || !(await canVerwalterAccessProperty(user, propertyId))) {
    return NextResponse.json({ error: "Objekt nicht gefunden" }, { status: 404 });
  }

  try {
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { name: true },
    });
    const owners = await db.ownership.findMany({
      where: { propertyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { user: { name: "asc" } },
    });
    const totalMea = owners.reduce((s, o) => s + (o.mea ?? 0), 0);

    // CSV-Escaping + Schutz vor Formel-Injection: Zellen, die mit =,+,-,@ oder
    // einem Steuerzeichen beginnen, werden mit ' entwertet (Excel/LibreOffice
    // würden sie sonst als Formel ausführen).
    const esc = (v: string) => {
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["Eigentümer", "E-Mail", "MEA", "Stimmanteil %"].map(esc).join(";"),
      ...owners.map((o) => {
        const share =
          totalMea > 0 && o.mea != null ? ((o.mea / totalMea) * 100).toFixed(2) : "";
        return [o.user.name, o.user.email ?? "", o.mea?.toString() ?? "", share]
          .map((v) => esc(String(v)))
          .join(";");
      }),
      ["Summe", "", totalMea.toString(), ""].map(esc).join(";"),
    ];
    // BOM für korrekte Umlaut-Darstellung in Excel.
    const csv = "﻿" + rows.join("\r\n");
    const fileName = `Eigentuemerliste_${(property?.name ?? "Objekt").replace(/[^a-zA-Z0-9]/g, "_")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    console.error("Eigentümer-CSV-Export fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
