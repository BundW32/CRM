import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { isPlatformAdminUser } from "./platform-admin";

const COOKIE_NAME = "bw_session";
const SESSION_DAYS = 7;
// Impersonation ("Als Kunde ansehen"): ein zusätzlicher, kurzlebiger Cookie ÜBER
// der echten Betreiber-Session. Die echte Session (bw_session) bleibt der
// Plattform-Admin – so kann man sich nie aussperren; Beenden = Cookie löschen.
const IMPERSONATE_COOKIE = "bw_impersonate";
const IMPERSONATE_HOURS = 2;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen)");
  }
  return new TextEncoder().encode(value);
}

// Beide Token-Arten werden mit demselben Schlüssel signiert. Ohne ein Merkmal,
// das sie unterscheidet, wäre ein Impersonations-Token ein vollwertiges
// Sitzungs-Token für die Zielperson: Der Betreiber müsste den Cookie-Inhalt nur
// von `bw_impersonate` nach `bw_session` kopieren und arbeitete danach als der
// Kunde – ohne Hinweisleiste, ohne dass getSession() die Stellvertretung
// erkennt, ohne Eintrag im Protokoll. Genau die Nachvollziehbarkeit, die die
// Support-Ansicht zusichert, wäre damit hinfällig. Deshalb trägt jedes Token
// seinen Zweck, und geprüft wird gegen den erwarteten.
const TYP_SESSION = "session";
const TYP_IMPERSONATION = "impersonation";
// Zwischenzustand der Zwei-Faktor-Anmeldung: Passwort war richtig, der zweite
// Faktor fehlt noch. Bewusst ein EIGENER Typ und ein eigener Cookie — ein
// mfa-pending-Token darf nie als Sitzung durchgehen, sonst wäre der zweite
// Faktor nur Dekoration (dieselbe Überlegung wie bei der Impersonation oben).
const TYP_MFA_PENDING = "mfa-pending";
const MFA_COOKIE = "bw_mfa";
const MFA_PENDING_MINUTES = 10;

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId, typ: TYP_SESSION })
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
  cookieStore.delete(IMPERSONATE_COOKIE);
  cookieStore.delete(MFA_COOKIE);
}

// ── Zwei-Faktor-Zwischenschritt (P1-10) ──────────────────────────────────────

/** Nach richtiger Passworteingabe: kurzlebiger Merker „zweiter Faktor fehlt". */
export async function createMfaPending(userId: string) {
  const token = await new SignJWT({ sub: userId, typ: TYP_MFA_PENDING })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_PENDING_MINUTES}m`)
    .sign(secret());
  const cookieStore = await cookies();
  cookieStore.set(MFA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Nur an die MFA-Seite senden, nicht an jede Anfrage des Portals.
    path: "/login/mfa",
    maxAge: 60 * MFA_PENDING_MINUTES,
  });
}

/** Liefert die Nutzer-Kennung des laufenden Zwischenschritts — oder null. */
export async function readMfaPending(): Promise<string | null> {
  const cookieStore = await cookies();
  const verified = await verifyToken(cookieStore.get(MFA_COOKIE)?.value, TYP_MFA_PENDING);
  return verified?.sub ?? null;
}

export async function clearMfaPending() {
  const cookieStore = await cookies();
  // Pfadgebundene Cookies löschen sich nur mit demselben Pfad.
  cookieStore.set(MFA_COOKIE, "", { path: "/login/mfa", maxAge: 0 });
}

// Lädt einen Nutzer inkl. Org-Aktiv-Status. `requireOrgActive=false` erlaubt das
// Laden trotz deaktivierter Org (für Impersonation in einen gesperrten Kunden).
async function loadUser(id: string, requireOrgActive = true) {
  const record = await db.user.findUnique({
    where: { id },
    include: { organization: { select: { active: true } } },
  });
  if (!record || !record.active) return null;
  if (requireOrgActive && !record.organization.active && !isPlatformAdminUser(record)) return null;
  return record;
}

// Ein geprüftes Token: Kennung des Nutzers und Ausstellungszeitpunkt. Letzterer
// wird gegen `sessionsValidFrom` gehalten, damit ein Passwortwechsel bestehende
// Anmeldungen beendet.
type VerifiedToken = { sub: string; issuedAt: Date | null };

function verifyToken(
  token: string | undefined,
  erwarteterTyp: string
): Promise<VerifiedToken | null> {
  if (!token) return Promise.resolve(null);
  return jwtVerify(token, secret())
    .then(({ payload }) => {
      if (typeof payload.sub !== "string") return null;
      // Token ohne `typ` stammen aus der Zeit vor der Trennung. Sie gelten
      // nicht mehr: Ein Altbestand, der als beides durchginge, wäre genau die
      // Lücke, die hier geschlossen wird. Die Betroffenen melden sich einmal
      // neu an – ihre Token wären ohnehin binnen sieben Tagen abgelaufen.
      if (payload.typ !== erwarteterTyp) return null;
      return {
        sub: payload.sub,
        issuedAt: typeof payload.iat === "number" ? new Date(payload.iat * 1000) : null,
      };
    })
    .catch(() => null);
}

// Wurde das Token vor dem letzten Sitzungswiderruf ausgestellt?
//
// Eine Sekunde Nachsicht, weil `iat` im Token auf ganze Sekunden abgerundet
// wird: Ohne sie verwürfe ein Passwortwechsel die Sitzung, die er im selben
// Augenblick neu anlegt, und der Nutzer landete direkt nach dem Ändern wieder
// auf der Anmeldeseite.
function tokenWiderrufen(token: VerifiedToken, validFrom: Date | null): boolean {
  if (!validFrom) return false;
  if (!token.issuedAt) return true;
  return token.issuedAt.getTime() < validFrom.getTime() - 1000;
}

export type SessionContext = {
  realUser: Awaited<ReturnType<typeof loadUser>>;
  user: Awaited<ReturnType<typeof loadUser>>;
  impersonating: boolean;
};

// Pro Request gecacht: echte Session + ggf. aktive Impersonation auflösen.
export const getSession = cache(async (): Promise<SessionContext> => {
  const cookieStore = await cookies();
  const real = await verifyToken(cookieStore.get(COOKIE_NAME)?.value, TYP_SESSION);
  const realUser = real ? await loadUser(real.sub) : null;
  if (!real || !realUser) return { realUser: null, user: null, impersonating: false };
  // Widerrufen (Passwortwechsel, „überall abmelden") → wie nicht angemeldet.
  if (tokenWiderrufen(real, realUser.sessionsValidFrom)) {
    return { realUser: null, user: null, impersonating: false };
  }

  // Impersonation nur wirksam, wenn die ECHTE Session ein Plattform-Betreiber ist
  // (wird bei jedem Request neu geprüft – verlorene Rechte beenden sie sofort).
  const imp = await verifyToken(cookieStore.get(IMPERSONATE_COOKIE)?.value, TYP_IMPERSONATION);
  if (imp && imp.sub !== realUser.id && isPlatformAdminUser(realUser)) {
    const target = await loadUser(imp.sub, false);
    if (target && !tokenWiderrufen(imp, target.sessionsValidFrom)) {
      return { realUser, user: target, impersonating: true };
    }
  }
  return { realUser, user: realUser, impersonating: false };
});

// Pro Request gecacht: der EFFEKTIVE Nutzer (bei Impersonation der Kunde).
export const getUser = cache(async () => (await getSession()).user);

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Startet eine Impersonation: signierten Cookie mit der Ziel-User-Id setzen.
// Der Aufrufer MUSS vorher als Plattform-Admin verifiziert sein.
export async function setImpersonation(targetUserId: string) {
  const token = await new SignJWT({ sub: targetUserId, typ: TYP_IMPERSONATION })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${IMPERSONATE_HOURS}h`)
    .sign(secret());
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * IMPERSONATE_HOURS,
  });
}

// Beendet die Impersonation (Cookie löschen). Immer sicher – reaktiviert nur die
// eigene echte Session.
export async function clearImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
}

// Pro Request gecacht: die Organisation (Mandant) des EFFEKTIVEN Nutzers.
// Liefert die Branding-/Impressum-Daten für Layout, Logo und Theming.
export const getOrganization = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  return db.organization.findUnique({ where: { id: user.organizationId } });
});

/**
 * Beendet ALLE bestehenden Anmeldungen eines Nutzers – auf jedem Gerät.
 *
 * Nach jedem Passwortwechsel aufzurufen. Das ist die eigentliche Wirkung, die
 * ein Nutzer von einem Passwortwechsel erwartet: Wer das alte Passwort hatte,
 * ist danach draußen. Ohne diesen Aufruf bliebe eine erbeutete Sitzung sieben
 * Tage lang gültig, obwohl das Passwort längst ein anderes ist.
 *
 * Der aufrufende Vorgang legt anschließend bei Bedarf eine neue Sitzung an
 * (siehe `createSession`); deren Token wird nach `sessionsValidFrom`
 * ausgestellt und gilt daher weiter.
 */
export async function revokeSessions(userId: string) {
  await db.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date() },
  });
}

export async function requireVerwalter() {
  const user = await requireUser();
  if (user.role !== "VERWALTER") redirect("/dashboard");
  return user;
}
