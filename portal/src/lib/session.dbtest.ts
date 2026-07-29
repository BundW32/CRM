// Sitzungswiderruf und Token-Trennung — gegen echte Datenbank und echte Tokens.
//
// Beides sind Behauptungen, die nur ein Durchlauf belegen kann: dass ein
// widerrufenes Token nicht mehr trägt, und dass ein Impersonations-Token keine
// Sitzung ist. Der Cookie-Speicher von Next.js wird ersetzt, alles andere ist
// echt — dieselbe Signatur, dieselbe Prüfung, dieselbe Datenbank.
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

const SECRET = "test-secret-mit-mindestens-32-zeichen-laenge";
process.env.SESSION_SECRET = SECRET;

// Der Cookie-Speicher, den die Tests befüllen.
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

// `react.cache` speichert je Aufruf – im Test soll jeder Durchlauf neu prüfen.
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const { getSession, revokeSessions } = await import("./session");

const key = new TextEncoder().encode(SECRET);

async function token(sub: string, typ: string | undefined, iat?: Date) {
  const payload: Record<string, unknown> = { sub };
  if (typ) payload.typ = typ;
  const b = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d");
  return (iat ? b.setIssuedAt(Math.floor(iat.getTime() / 1000)) : b.setIssuedAt()).sign(key);
}

let a: Fixture;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("sess");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

beforeEach(() => cookieJar.clear());

describe("P0-3: Token-Trennung", () => {
  it("nimmt ein gültiges Sitzungs-Token an", async () => {
    cookieJar.set("bw_session", await token(a.verwalter.id, "session"));
    expect((await getSession()).user?.id).toBe(a.verwalter.id);
  });

  it("lehnt ein Impersonations-Token als Sitzung ab", async () => {
    // Der Angriff: Cookie-Inhalt von bw_impersonate nach bw_session kopieren.
    // Vorher hätte das eine vollwertige, unprotokollierte Sitzung ergeben.
    cookieJar.set("bw_session", await token(a.verwalter.id, "impersonation"));
    expect((await getSession()).user).toBeNull();
  });

  it("lehnt ein Token ohne Zweckangabe ab (Altbestand)", async () => {
    cookieJar.set("bw_session", await token(a.verwalter.id, undefined));
    expect((await getSession()).user).toBeNull();
  });

  it("lehnt ein fremd signiertes Token ab", async () => {
    const fremd = await new SignJWT({ sub: a.verwalter.id, typ: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("ein-voellig-anderes-secret-mit-32-zeichen"));
    cookieJar.set("bw_session", fremd);
    expect((await getSession()).user).toBeNull();
  });
});

describe("P0-2: Sitzungswiderruf", () => {
  it("entwertet ein Token, das vor dem Widerruf ausgestellt wurde", async () => {
    const alt = await token(a.mieter.id, "session", new Date(Date.now() - 60_000));
    cookieJar.set("bw_session", alt);
    expect((await getSession()).user?.id).toBe(a.mieter.id);

    // Das ist der Passwortwechsel: Ab hier muss das alte Token wertlos sein.
    await revokeSessions(a.mieter.id);

    expect((await getSession()).user).toBeNull();
  });

  it("lässt ein danach ausgestelltes Token weiter gelten", async () => {
    // Sonst würfe der Passwortwechsel den Nutzer aus seiner eigenen, gerade
    // erst erneuerten Sitzung.
    await revokeSessions(a.eigentuemer.id);
    cookieJar.set("bw_session", await token(a.eigentuemer.id, "session"));
    expect((await getSession()).user?.id).toBe(a.eigentuemer.id);
  });

  it("schreibt den Widerrufszeitpunkt in die Datenbank", async () => {
    await revokeSessions(a.verwalter.id);
    const nutzer = await db.user.findUnique({ where: { id: a.verwalter.id } });
    expect(nutzer?.sessionsValidFrom).toBeInstanceOf(Date);
  });
});
