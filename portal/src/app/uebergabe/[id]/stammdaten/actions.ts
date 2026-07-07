"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import type { HandoverType } from "@/generated/prisma/client";

export async function saveStammdaten(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  if (!(await canVerwalterAccessHandover(verwalter, id))) redirect("/uebergabe");

  const type = String(formData.get("type") ?? "EINZUG") as HandoverType;

  // Freitextfelder auf eine großzügige Obergrenze begrenzen (verhindert
  // unbegrenzte Speicherlast; deckt Namen/Adressen ebenso wie Notizen ab).
  const strField = (name: string) => String(formData.get(name) ?? "").trim().slice(0, 2000) || null;
  const intField = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v !== "" ? Math.trunc(Number(v)) : null;
  };
  // Akzeptiert "72,5" oder "72.5"
  const floatField = (name: string) => {
    const v = String(formData.get(name) ?? "").trim().replace(",", ".");
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const dateField = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v ? new Date(v) : null;
  };

  const action = String(formData.get("_action") ?? "next");
  const handoverDate = dateField("handoverDate");

  await db.handover.update({
    where: { id },
    data: {
      type,
      handoverDate: handoverDate ?? undefined,
      moveDate: dateField("moveDate"),
      livingArea: floatField("livingArea"),
      roomCount: floatField("roomCount"),
      personCount: intField("personCount"),
      tenantName: strField("tenantName"),
      tenantEmail: strField("tenantEmail"),
      tenantPhone: strField("tenantPhone"),
      tenantAddress: strField("tenantAddress"),
      tenantBirthDate: dateField("tenantBirthDate"),
      tenant2Name: strField("tenant2Name"),
      tenant2BirthDate: dateField("tenant2BirthDate"),
      ownerName: strField("ownerName"),
      ownerEmail: strField("ownerEmail"),
      ownerPhone: strField("ownerPhone"),
      managerCompany: strField("managerCompany"),
      managerName: strField("managerName"),
      managerEmail: strField("managerEmail"),
      managerPhone: strField("managerPhone"),
      keysApartment: intField("keysApartment"),
      keysMailbox: intField("keysMailbox"),
      keysBasement: intField("keysBasement"),
      keysGarage: intField("keysGarage"),
      keysOther: strField("keysOther"),
      parkingSpace: strField("parkingSpace"),
      cellarSpace: strField("cellarSpace"),
    },
  });

  if (action === "save") redirect(`/uebergabe`);
  redirect(`/uebergabe/${id}/raeume`);
}
