"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PLANS, SUBSCRIPTION_STATUSES, type PlanId, type SubscriptionStatus } from "@/lib/billing";
import { db } from "@/lib/db";
import { AUDIT, logAudit } from "@/lib/audit";
import { computeTrialEnd, requirePlatformAdmin } from "@/lib/platform";
import { getClientIp } from "@/lib/rate-limit";

function backTo(id: string) {
  return `/plattform/organisationen/${id}`;
}

// Verwaltung deaktivieren/reaktivieren. Eine deaktivierte Org sperrt alle ihre
// Nutzer aus (siehe getUser/login). Die eigene Org des Betreibers ist tabu.
export async function setOrganizationActive(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "1";
  if (!id) redirect("/plattform/organisationen");
  if (id === admin.organizationId) redirect(`${backTo(id)}?fehler=eigene`);

  const org = await db.organization.findUnique({ where: { id }, select: { active: true } });
  if (!org) redirect("/plattform/organisationen");

  await db.organization.update({ where: { id }, data: { active } });
  await logAudit({
    actorId: admin.id,
    action: active ? AUDIT.PLATFORM_ORG_REACTIVATED : AUDIT.PLATFORM_ORG_DEACTIVATED,
    targetType: "Organization",
    targetId: id,
    meta: { from: org.active, to: active },
    ip: await getClientIp(),
  });
  revalidatePath(backTo(id));
  redirect(backTo(id));
}

// Tarif + Abo-Status manuell setzen (bis Stripe das übernimmt).
export async function setOrganizationPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const plan = String(formData.get("plan") ?? "");
  const status = String(formData.get("subscriptionStatus") ?? "");
  if (!id) redirect("/plattform/organisationen");
  if (!(plan in PLANS) || !SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)) {
    redirect(`${backTo(id)}?fehler=eingabe`);
  }

  const before = await db.organization.findUnique({
    where: { id },
    select: { plan: true, subscriptionStatus: true },
  });
  if (!before) redirect("/plattform/organisationen");

  await db.organization.update({
    where: { id },
    data: { plan: plan as PlanId, subscriptionStatus: status as SubscriptionStatus },
  });
  await logAudit({
    actorId: admin.id,
    action: AUDIT.PLATFORM_ORG_PLAN_CHANGED,
    targetType: "Organization",
    targetId: id,
    meta: { from: before, to: { plan, subscriptionStatus: status } },
    ip: await getClientIp(),
  });
  revalidatePath(backTo(id));
  redirect(backTo(id));
}

// Testphase verlängern: entweder um feste Tage (+30/+90) oder auf ein Datum.
// Setzt den Status zurück auf "trialing".
export async function extendTrial(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const mode = String(formData.get("mode") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  if (!id) redirect("/plattform/organisationen");

  const org = await db.organization.findUnique({ where: { id }, select: { trialEndsAt: true } });
  if (!org) redirect("/plattform/organisationen");

  let newEnd: Date | null = null;
  if (mode === "30" || mode === "90") {
    newEnd = computeTrialEnd(org.trialEndsAt, new Date(), Number(mode));
  } else if (mode === "date" && dateStr) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) newEnd = d;
  }
  if (!newEnd) redirect(`${backTo(id)}?fehler=eingabe`);

  await db.organization.update({
    where: { id },
    data: { trialEndsAt: newEnd, subscriptionStatus: "trialing" },
  });
  await logAudit({
    actorId: admin.id,
    action: AUDIT.PLATFORM_TRIAL_EXTENDED,
    targetType: "Organization",
    targetId: id,
    meta: { from: org.trialEndsAt?.toISOString() ?? null, to: newEnd.toISOString() },
    ip: await getClientIp(),
  });
  revalidatePath(backTo(id));
  redirect(backTo(id));
}

// Interne Kundennotiz speichern.
export async function savePlatformNote(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 5000) || null;
  if (!id) redirect("/plattform/organisationen");

  const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org) redirect("/plattform/organisationen");

  await db.organization.update({ where: { id }, data: { platformNote: note } });
  await logAudit({
    actorId: admin.id,
    action: AUDIT.PLATFORM_NOTE_SAVED,
    targetType: "Organization",
    targetId: id,
    ip: await getClientIp(),
  });
  revalidatePath(backTo(id));
  redirect(backTo(id));
}
