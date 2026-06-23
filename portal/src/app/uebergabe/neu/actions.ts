"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function createHandover(formData: FormData) {
  const user = await requireUser();
  const unitId = String(formData.get("unitId") ?? "").trim();
  const type = String(formData.get("type") ?? "EINZUG") as "EINZUG" | "AUSZUG" | "ZWISCHENZUSTAND";
  const dateStr = String(formData.get("handoverDate") ?? "");
  if (!unitId) return;

  const unit = await db.unit.findUnique({
    where: { id: unitId },
    include: {
      property: { include: { ownerships: { include: { user: true }, take: 1 } } },
      tenancies: { where: { active: true }, include: { user: true }, take: 1 },
      meters: { include: { readings: { orderBy: { readingDate: "desc" }, take: 1 } } },
    },
  });
  if (!unit) return;

  const tenant = unit.tenancies[0]?.user;
  const owner = unit.property.ownerships[0]?.user;

  const handover = await db.handover.create({
    data: {
      type,
      handoverDate: dateStr ? new Date(dateStr) : new Date(),
      unitId,
      createdById: user.id,
      tenantName: tenant?.name ?? null,
      tenantEmail: tenant?.email ?? null,
      tenantPhone: tenant?.phone ?? null,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      managerName: user.name,
      managerEmail: user.email ?? null,
    },
  });

  if (unit.meters.length > 0) {
    await db.handoverMeter.createMany({
      data: unit.meters.map((m, i) => ({
        handoverId: handover.id,
        meterType: m.type,
        meterNumber: m.meterNumber ?? null,
        sortOrder: i,
      })),
    });
  }

  redirect(`/uebergabe/${handover.id}/stammdaten`);
}
