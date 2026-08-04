import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-hash";

export const dynamic = "force-dynamic";

// Bestätigt die E-Mail-Adresse über den per Mail versandten Token und leitet auf
// eine Ergebnisseite. Als Route-Handler (kein React-Render) sind Zeit-/DB-
// Operationen hier unproblematisch. Idempotent: ungültige/abgelaufene Tokens
// führen nur zu einem Hinweis, nie zu einem Fehler.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let status: "ok" | "expired" | "invalid" = "invalid";

  const user = await db.user.findFirst({
    where: { emailVerifyToken: hashToken(token) },
    select: { id: true, emailVerifyExpiry: true },
  });

  if (user) {
    if (user.emailVerifyExpiry && user.emailVerifyExpiry.getTime() < Date.now()) {
      status = "expired";
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date(), emailVerifyToken: null, emailVerifyExpiry: null },
      });
      status = "ok";
    }
  }

  return NextResponse.redirect(new URL(`/registrieren/bestaetigt?status=${status}`, request.url));
}
