"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { AUDIT, logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const kennung = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const ip = await getClientIp();

  // Rate limit: 5 Versuche pro IP pro 15 Minuten
  if (!(await checkRateLimit(`login:${ip}`, 5, 900))) {
    redirect("/login?fehler=limit");
  }

  // Anmeldung per E-Mail-Adresse oder per Benutzername (Zugänge ohne E-Mail)
  let user = null;
  if (kennung) {
    user = kennung.includes("@")
      ? await db.user.findUnique({
          where: { email: kennung },
          include: { organization: { select: { active: true } } },
        })
      : await db.user.findUnique({
          where: { username: kennung },
          include: { organization: { select: { active: true } } },
        });
  }

  // Deaktivierte Organisation sperrt den Login (außer Plattform-Betreiber). Wie
  // ein falsches Passwort behandeln – keine Auskunft über den Grund (kein Leak).
  const orgBlocked = user ? !user.organization.active && !user.isPlatformAdmin : false;

  if (
    !user ||
    !user.active ||
    orgBlocked ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    await logAudit({ action: AUDIT.LOGIN_FAILED, meta: { kennung: kennung || null }, ip });
    redirect("/login?fehler=1");
  }

  await logAudit({ actorId: user.id, action: AUDIT.LOGIN_SUCCESS, ip });
  await createSession(user.id);

  // Router-Cache leeren, damit nach einem Nutzerwechsel keine Inhalte aus
  // einer früheren Session (anderer Name/Rolle) angezeigt werden.
  revalidatePath("/", "layout");

  // Erst-Passwort aus dem Zugangsschreiben: zur Passwortänderung zwingen
  if (user.mustChangePassword) {
    redirect("/passwort-festlegen");
  }

  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}
