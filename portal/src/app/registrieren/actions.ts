"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hinweiseVoreinstellung } from "@/lib/access";
import { brandingFromOrg } from "@/lib/branding";
import { portalUrlFromRequest, sendMail } from "@/lib/mailer";
import { createSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isReservedSlug } from "@/lib/slug";
import { trialDays } from "@/lib/platform";
import { registrationEnabled } from "@/lib/app-mode";
import { hashToken } from "@/lib/token-hash";

// Version der bei der Registrierung akzeptierten Rechtsdokumente (AGB/AVV).
// Bei inhaltlichen Änderungen hochzählen → erneute Zustimmung einholbar.
const TERMS_VERSION = "2026-06-28";

const registerSchema = z.object({
  company: z.string().trim().min(2).max(200),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(2).max(100),
  salutation: z.enum(["Herr", "Frau"]).optional(),
  email: z.email(),
  password: z.string().min(10).max(200),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

// Findet einen freien Slug: zuerst den sauberen, dann mit kurzem Zufallssuffix.
async function uniqueSlug(base: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${crypto.randomBytes(2).toString("hex")}`;
    // Reservierte Slugs (www/app/portal/admin/api) nie vergeben – nächster Versuch.
    if (isReservedSlug(candidate)) continue;
    const exists = await db.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

// Self-Service-Registrierung: legt eine NEUE Organisation (Mandant) samt
// erstem SuperAdmin an und meldet ihn direkt an. Danach geht es in den
// Onboarding-Assistenten (Logo, Farbe, Impressum).
export async function registerOrganization(formData: FormData) {
  // Harte Sperre: Registrierung nur in der WEG-SaaS-Variante (APP_MODE=weg).
  // Schützt die Server-Action unabhängig davon, ob die Seite erreichbar war.
  if (!registrationEnabled()) {
    redirect("/login");
  }

  // Honeypot: ein für Menschen unsichtbares Feld. Füllt es ein Bot aus, tun wir
  // so, als sei alles gut (kein Hinweis auf die Erkennung), legen aber nichts an.
  if (String(formData.get("hp_url") ?? "").trim()) {
    redirect("/login");
  }

  // Zustimmung zu AGB/AVV ist Pflicht (Nachweis wird auf der Org gespeichert).
  if (String(formData.get("terms") ?? "") !== "1") {
    redirect("/registrieren?fehler=agb");
  }

  const ip = await getClientIp();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 500) ?? null;
  // Missbrauchsschutz: max. 5 Registrierungen pro IP und Stunde.
  if (!(await checkRateLimit(`register:${ip}`, 5, 3600))) {
    redirect("/registrieren?fehler=limit");
  }

  const salutationRaw = String(formData.get("salutation") ?? "");
  const parsed = registerSchema.safeParse({
    company: formData.get("company"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    salutation: salutationRaw === "Herr" || salutationRaw === "Frau" ? salutationRaw : undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/registrieren?fehler=eingabe");
  }
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    redirect("/registrieren?fehler=email");
  }

  const slug = await uniqueSlug(slugify(parsed.data.company));
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 Tage
  // Herkunft nur in eng begrenzter, unbedenklicher Form übernehmen.
  const referralSource =
    String(formData.get("ref") ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 40) || null;
  // WEG-SaaS: Kontotyp IMMER "selbstverwalter" – unabhängig vom Formular.
  // (Die B&W-Variante erreicht diese Action ohnehin nicht, s. Sperre oben.)
  const accountType = "selbstverwalter";

  // Testphase: 30 Tage, über HausMatch 90 Tage ("drei Monate gratis").
  const trialEndsAt = new Date(Date.now() + trialDays(referralSource) * 86_400_000);

  // Org + Gründer-SuperAdmin atomisch anlegen.
  const { user, org } = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        slug,
        name: parsed.data.company,
        accountType,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
        termsAcceptedIp: ip,
        termsAcceptedUserAgent: userAgent,
        referralSource,
        trialEndsAt,
      },
    });
    const user = await tx.user.create({
      data: {
        name: fullName,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        salutation: parsed.data.salutation ?? null,
        email,
        role: "VERWALTER",
        passwordHash,
        organizationId: org.id,
        isSuperAdmin: true,
        // Erklärende Hinweise für Selbstverwaltungen an, für professionelle
        // Verwaltungen aus – umschaltbar unter „Konto".
        showHints: hinweiseVoreinstellung("VERWALTER", { accountType }),
        // Nur der Hash landet in der Datenbank – der Rohwert bleibt allein im
        // Bestätigungslink.
        emailVerifyToken: hashToken(verifyToken),
        emailVerifyExpiry: verifyExpiry,
      },
    });
    return { user, org };
  });

  // Willkommens- + Bestätigungs-E-Mail (Branding aus der frischen Org).
  const branding = brandingFromOrg(org);
  const verifyLink = await portalUrlFromRequest(`/registrieren/bestaetigen/${verifyToken}`);
  const selfManaged = accountType === "selbstverwalter";
  const introLine = selfManaged
    ? `willkommen! Für Ihre WEG „${parsed.data.company}" wurde ein Selbstverwaltungs-Zugang angelegt.\n\n`
    : `willkommen! Für „${parsed.data.company}" wurde ein Verwalter-Konto angelegt.\n\n`;
  const nextStepLine = selfManaged
    ? `Danach legen Sie unter „WEG-Verwaltung" Ihr Objekt an und tragen die Eigentümer mit ihren Miteigentumsanteilen ein.\n\n`
    : `Danach können Sie Ihr Portal unter „Verwaltung → Branding" vollständig einrichten.\n\n`;
  await sendMail(
    email,
    "Willkommen – bitte bestätigen Sie Ihre E-Mail-Adresse",
    `Guten Tag ${fullName},\n\n` +
      introLine +
      `Bitte bestätigen Sie Ihre E-Mail-Adresse über diesen Link (gültig 3 Tage):\n` +
      `${verifyLink}\n\n` +
      nextStepLine +
      `Mit freundlichen Grüßen\n${branding.legalName}`,
    undefined,
    branding
  );

  await createSession(user.id);
  redirect("/onboarding");
}
