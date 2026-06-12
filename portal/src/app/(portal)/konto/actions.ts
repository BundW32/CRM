"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    redirect("/konto?fehler=aktuell");
  }
  if (next.length < 10 || next.length > 200) {
    redirect("/konto?fehler=laenge");
  }
  if (next !== repeat) {
    redirect("/konto?fehler=wiederholung");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });

  redirect("/konto?ok=1");
}
