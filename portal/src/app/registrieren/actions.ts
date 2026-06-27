"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const registerSchema = z.object({
  company: z.string().trim().min(2).max(200),
  name: z.string().trim().min(2).max(200),
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
  const ip = await getClientIp();
  // Missbrauchsschutz: max. 5 Registrierungen pro IP und Stunde.
  if (!(await checkRateLimit(`register:${ip}`, 5, 3600))) {
    redirect("/registrieren?fehler=limit");
  }

  const parsed = registerSchema.safeParse({
    company: formData.get("company"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/registrieren?fehler=eingabe");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    redirect("/registrieren?fehler=email");
  }

  const slug = await uniqueSlug(slugify(parsed.data.company));
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  // Org + Gründer-SuperAdmin atomisch anlegen.
  const user = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { slug, name: parsed.data.company },
    });
    return tx.user.create({
      data: {
        name: parsed.data.name,
        email,
        role: "VERWALTER",
        passwordHash,
        organizationId: org.id,
        isSuperAdmin: true,
      },
    });
  });

  await createSession(user.id);
  redirect("/onboarding");
}
