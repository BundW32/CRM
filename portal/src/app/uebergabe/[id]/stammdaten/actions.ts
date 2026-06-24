"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import type { HandoverType } from "@/generated/prisma/client";

export async function saveStammdaten(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const type = String(formData.get("type") ?? "EINZUG") as HandoverType;
  const dateStr = String(formData.get("handoverDate") ?? "");

  const numField = (name: string) => {
    const v = formData.get(name);
    return v !== null && v !== "" ? Number(v) : null;
  };
  const strField = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const action = String(formData.get("_action") ?? "next");

  await db.handover.update({
    where: { id },
    data: {
      type,
      handoverDate: dateStr ? new Date(dateStr) : undefined,
      tenantName: strField("tenantName"),
      tenantEmail: strField("tenantEmail"),
      tenantPhone: strField("tenantPhone"),
      tenantAddress: strField("tenantAddress"),
      ownerName: strField("ownerName"),
      ownerEmail: strField("ownerEmail"),
      ownerPhone: strField("ownerPhone"),
      managerName: strField("managerName"),
      managerEmail: strField("managerEmail"),
      managerPhone: strField("managerPhone"),
      keysApartment: numField("keysApartment"),
      keysMailbox: numField("keysMailbox"),
      keysBasement: numField("keysBasement"),
      keysGarage: numField("keysGarage"),
      keysOther: strField("keysOther"),
      parkingSpace: strField("parkingSpace"),
      cellarSpace: strField("cellarSpace"),
    },
  });

  if (action === "save") redirect(`/uebergabe`);
  redirect(`/uebergabe/${id}/raeume`);
}
