import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const COOKIE_NAME = "bw_session";
const SESSION_DAYS = 7;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen)");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Pro Request gecacht: Session lesen und Nutzer laden
export const getUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string") return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    return user && user.active ? user : null;
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Pro Request gecacht: die Organisation (Mandant) des angemeldeten Nutzers.
// Liefert die Branding-/Impressum-Daten für Layout, Logo und Theming.
export const getOrganization = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  return db.organization.findUnique({ where: { id: user.organizationId } });
});

export async function requireVerwalter() {
  const user = await requireUser();
  if (user.role !== "VERWALTER") redirect("/dashboard");
  return user;
}
