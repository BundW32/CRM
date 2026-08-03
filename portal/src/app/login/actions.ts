"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import { AUDIT, logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const kennung = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const ip = await getClientIp();

  // Zwei Grenzen statt einer.
  //
  // Bisher galt allein: fünf Versuche pro IP je 15 Minuten. Das ist für eine
  // Hausverwaltung gedacht, in der jeder von woanders kommt — für eine
  // selbstverwaltete WEG ist es das Gegenteil: Deren Eigentümer wohnen im selben
  // Haus und sitzen nicht selten hinter demselben Anschluss. Fünf Fehlversuche
  // eines Nachbarn sperrten damit alle anderen für eine Viertelstunde mit aus,
  // ohne dass sie je etwas falsch gemacht hätten.
  //
  // Deshalb: Die enge Grenze hängt jetzt an der **Kennung** — fünf Versuche je
  // Konto, denn ein Angriff auf ein Passwort zielt immer auf ein bestimmtes
  // Konto. Die IP behält eine deutlich weitere Grenze, die das massenhafte
  // Durchprobieren vieler Konten von einer Stelle aus weiter abfängt, eine
  // Familie am gemeinsamen Anschluss aber in Ruhe lässt.
  // Gezählt werden nur Fehlversuche: Ein Erfolg räumt beide Zähler ab (siehe
  // unten). Sonst sperrte die Grenze am Ende genau den aus, der sein Passwort
  // kennt und sich an einem Vormittag mehrfach anmeldet.
  //
  // Die Kennung wird gekappt, damit niemand die Zählertabelle mit beliebig
  // langen Schlüsseln vollschreiben kann.
  const kennungKey = `login:kennung:${kennung.slice(0, 120)}`;
  const ipKey = `login:${ip}`;
  const kennungLimit = kennung ? await checkRateLimit(kennungKey, 5, 900) : true;
  const ipLimit = await checkRateLimit(ipKey, 30, 900);
  if (!kennungLimit || !ipLimit) {
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
  const orgBlocked = user ? !user.organization.active && !isPlatformAdminUser(user) : false;

  // Handwerker haben kein Portalkonto mehr: Sie erhalten ihre Aufträge per E-Mail
  // mit Magic-Link auf /auftraege/[token]. Alte Konten aus der Zeit davor können
  // sich nicht mehr anmelden. Der Rollenwert bleibt im Datenmodell erhalten –
  // ihn zu entfernen würde an bestehenden Zeilen scheitern und bringt nichts.
  const roleBlocked = user?.role === "HANDWERKER";

  if (
    !user ||
    !user.active ||
    orgBlocked ||
    roleBlocked ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    await logAudit({ action: AUDIT.LOGIN_FAILED, meta: { kennung: kennung || null }, ip });
    redirect("/login?fehler=1");
  }

  // Erfolg: beide Zähler abräumen, damit nur Fehlversuche zur Sperre führen.
  await Promise.all([resetRateLimit(kennungKey), resetRateLimit(ipKey)]);

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
