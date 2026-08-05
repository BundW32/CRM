"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { merkeErstzugaenge } from "@/lib/zugangsschreiben";
import { isSelfManaged } from "@/lib/access";
import {
  type PersonTreffer,
  searchPersons,
  verifyExistingPerson,
} from "@/lib/person-search";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { IMAGE_TYPES, saveUpload } from "@/lib/storage";
import { inviteOrLetter } from "@/lib/user-invite";
import { parseAnteil } from "@/lib/weg/anteil";
import { syncOwnerVotingWeights } from "@/lib/weg/mea-sync";

const MAX_UNITS = 100;
const MAX_TENANTS = 100;

function optInt(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function optFloat(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function optStr(raw: FormDataEntryValue | null, max = 200): string | null {
  const v = String(raw ?? "").trim();
  return v ? v.slice(0, max) : null;
}

// ── Bestehende Person statt Dublette ────────────────────────────────────────
// Dasselbe Muster wie beim Bearbeiten eines Objekts: Ab zwei getippten Zeichen
// im Nachnamen werden vorhandene Personen vorgeschlagen. Ohne diesen Vorschlag
// legte der Zugangsschreiben-Weg (kein E-Mail-Feld gefüllt) für jede Einheit
// ein weiteres Konto derselben Person an.
export async function searchPersonsForNewObjekt(
  query: string,
  role: "MIETER" | "EIGENTUEMER",
): Promise<PersonTreffer[]> {
  const actor = await requireVerwalter();
  return searchPersons(actor, query, role);
}

/**
 * Liefert die Person für eine Formularzeile: entweder die im Vorschlag
 * gewählte bestehende – dann entsteht KEIN zweiter Zugang – oder eine neu
 * angelegte über `inviteOrLetter`.
 *
 * Die gewählte ID stammt aus einem versteckten Feld und wird deshalb gegen
 * Organisation und Rolle geprüft, bevor sie verwendet wird.
 */
async function personFuerZeile(
  actor: User,
  chosenId: string,
  neu: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    role: "EIGENTUEMER" | "MIETER";
  },
): Promise<{ id: string; pw: string } | null> {
  if (chosenId) {
    const verified = await verifyExistingPerson(actor, chosenId, neu.role);
    // Eine ungültige ID darf nicht stillschweigend zu einem neuen Konto
    // führen – sonst wäre genau die Dublette zurück, die wir verhindern.
    return verified ? { id: verified, pw: "" } : null;
  }
  return inviteOrLetter({ ...neu, organizationId: actor.organizationId });
}

export async function createObjekt(formData: FormData) {
  const actor = await requireVerwalter();
  // Neue Objekte anzulegen ist eine Stammdaten-Aktion – nur SuperAdmin der Org
  // (eingeschränkte Verwalter verwalten nur ihre zugewiesenen Bestandsobjekte).
  if (!actor.isSuperAdmin) redirect("/verwaltung/objekte");

  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect("/verwaltung/objekte/neu?fehler=objekt");
  }

  // Selbstverwalter verwalten ausschließlich ihre eigene WEG – ein Mietshaus
  // (Mietverwaltung) dürfen sie nicht anlegen. Serverseitig erzwingen, unabhängig
  // vom übermittelten Formularwert.
  const org = await getOrganization();
  const managementType = isSelfManaged(org)
    ? "WEG"
    : String(formData.get("managementType") ?? "") === "WEG"
      ? "WEG"
      : "MIETVERWALTUNG";
  const vpRaw = String(formData.get("votingPrinciple") ?? "");
  const votingPrinciple = vpRaw === "MEA" ? "MEA" : vpRaw === "OBJEKT" ? "OBJEKT" : "KOPF";

  // Titelbild (optional) – ein Fehler beim Bild darf die Objektanlage nie blockieren.
  let titleImageStoredName: string | null = null;
  const titleImageFile = formData.get("titleImage");
  if (titleImageFile instanceof File && titleImageFile.size > 0) {
    try {
      titleImageStoredName = (await saveUpload(titleImageFile, IMAGE_TYPES)).storedName;
    } catch {
      titleImageStoredName = null;
    }
  }

  // ── Objekt anlegen (inkl. optionaler Stammdaten) ────────────────────
  const property = await db.property.create({
    data: {
      name,
      street,
      zip,
      city,
      managementType,
      votingPrinciple,
      organizationId: actor.organizationId,
      buildYear: optInt(formData.get("buildYear")),
      livingArea: optFloat(formData.get("livingArea")),
      floors: optInt(formData.get("floors")),
      buildingType: optStr(formData.get("buildingType")),
      heatingType: optStr(formData.get("heatingType")),
      notes: optStr(formData.get("notes"), 2000),
      titleImageStoredName,
    },
  });

  // ── Einheiten ───────────────────────────────────────────────────────
  // Fläche/MEA/Personen je Einheit indexgleich zu unitLabel einlesen (VOR dem
  // Leerfilter), damit die Zuordnung erhalten bleibt. MEA nur bei WEG.
  const unitLabels = formData.getAll("unitLabel").map((v) => String(v).trim());
  const unitExternals = formData.getAll("unitExternalLabel").map((v) => String(v).trim());
  const unitFloors = formData.getAll("unitFloor").map((v) => String(v).trim());
  const unitAreas = formData.getAll("unitArea").map((v) => String(v));
  const unitMeas = formData.getAll("unitMea").map((v) => String(v));
  const unitPersonsRaw = formData.getAll("unitPersons").map((v) => String(v));
  const unitLabelToId = new Map<string, string>();

  const unitsToCreate = unitLabels
    .map((label, i) => ({
      label: label.slice(0, 200),
      externalLabel: (unitExternals[i] ?? "").slice(0, 200) || null,
      floor: unitFloors[i] || undefined,
      livingArea: optFloat(unitAreas[i] ?? null),
      mea: managementType === "WEG" ? optInt(unitMeas[i] ?? null) : null,
      personCount: optInt(unitPersonsRaw[i] ?? null),
    }))
    .filter((u) => u.label.length > 0)
    .slice(0, MAX_UNITS);

  if (unitsToCreate.length > 0) {
    await db.unit.createMany({
      data: unitsToCreate.map((u) => ({
        propertyId: property.id,
        label: u.label,
        externalLabel: u.externalLabel,
        floor: u.floor,
        livingArea: u.livingArea,
        mea: u.mea,
        personCount: u.personCount,
      })),
    });
    const created = await db.unit.findMany({
      where: { propertyId: property.id },
      select: { id: true, label: true },
    });
    created.forEach((u) => unitLabelToId.set(u.label, u.id));

    // ── MEA-Nenner aus den erfassten Anteilen ableiten ──────────────────
    // Der Nenner ist ein zweites Feld neben der Summe der Einheiten-Anteile,
    // und dieses Formular fragte ihn nie ab. Wer hier 300 + 250 + 450 einträgt,
    // hat die 1.000 der Teilungserklärung bereits vollständig genannt — sah
    // danach aber auf den Stammdaten „MEA-Nenner fehlt". Eine Warnung direkt
    // nach einer fehlerfrei ausgefüllten Einrichtung, und zwar bei jedem
    // Neukunden.
    //
    // Übernommen wird die Summe nur, wenn **jede** Einheit einen Anteil trägt:
    // Bei einer Lücke wäre die Summe kleiner als der wirkliche Nenner, und ein
    // zu kleiner Nenner ist schlimmer als gar keiner — er lässt die Prüfung
    // aufgehen, obwohl Einheiten fehlen. Abweichende Nenner (die
    // Teilungserklärung nennt gelegentlich 10.000) bleiben in den Stammdaten
    // änderbar.
    if (managementType === "WEG" && unitsToCreate.every((u) => u.mea != null)) {
      const summe = unitsToCreate.reduce((s, u) => s + (u.mea ?? 0), 0);
      if (summe > 0) {
        await db.property.update({ where: { id: property.id }, data: { meaTotal: summe } });
      }
    }
  }

  // Sammlung aller Zugangsschreiben-Nutzer: [{id, pw}]
  const letterUsers: Array<{ id: string; pw: string }> = [];

  // ── Eigentümer (optional, einzeln) ──────────────────────────────────
  const eigFirst = String(formData.get("eigFirstName") ?? "").trim();
  const eigLast = String(formData.get("eigLastName") ?? "").trim();
  const eigName = `${eigFirst} ${eigLast}`.trim();
  if (eigName.length >= 2) {
    const eigEmailRaw = String(formData.get("eigEmail") ?? "").trim().toLowerCase();
    const result = await personFuerZeile(actor, String(formData.get("eigUserId") ?? "").trim(), {
      name: eigName,
      firstName: eigFirst || null,
      lastName: eigLast || null,
      email: eigEmailRaw && eigEmailRaw.includes("@") ? eigEmailRaw : null,
      phone: optStr(formData.get("eigPhone"), 50),
      role: "EIGENTUEMER",
    });
    if (result) {
      // catch: bereits bestehende Verknüpfung (Unique-Constraint) ignorieren
      await db.ownership
        .create({ data: { userId: result.id, propertyId: property.id } })
        .catch(() => {});
      if (result.pw) letterUsers.push(result);
    }
  }

  // ── WEG-Eigentümer je Einheit ───────────────────────────────────────
  // In einer WEG gehört jede Einheit einem eigenen Eigentümer. Legt je Zeile
  // einen Eigentümer an und verknüpft ihn mit der Einheit (UnitOwnership,
  // Grundlage der zeitanteiligen Abrechnung) UND objektweit (Ownership, für
  // Stimmrecht/MEA und Belegeinsicht).
  if (managementType === "WEG") {
    const ownerFirst = formData.getAll("wegOwnerFirstName").map((v) => String(v).trim());
    const ownerLast = formData.getAll("wegOwnerLastName").map((v) => String(v).trim());
    const ownerEmails = formData.getAll("wegOwnerEmail").map((v) => String(v).trim().toLowerCase());
    const ownerPhones = formData.getAll("wegOwnerPhone").map((v) => String(v).trim());
    const ownerUnits = formData.getAll("wegOwnerUnit").map((v) => String(v).trim());
    // „Eigentümer seit": Zuvor stand hier stumpf das Anlagedatum. Der Stichtag
    // entscheidet aber, wer bei einem Verkauf welchen Teil der Jahresabrechnung
    // trägt — ein falsches Datum verfälscht sie. Leer bleibt heute.
    const ownerSince = formData.getAll("wegOwnerSince").map((v) => String(v).trim());
    // Im Vorschlag gewählte bestehende Person – indexgleich zu den Namensfeldern.
    const ownerUserIds = formData.getAll("wegOwnerUserId").map((v) => String(v).trim());
    // Anteil an der Einheit (Miteigentum). Ohne dieses Feld blieb jede
    // Eigentümerschaft bei 100 %, und `mea-sync` zählte den MEA einer geteilten
    // Einheit für jeden Miteigentümer voll — die Summe lag über dem Nenner.
    const ownerShares = formData.getAll("wegOwnerShare").map((v) => parseAnteil(v));
    // Antwort auf die Dublettenfrage: Index einer FRÜHEREN Zeile derselben
    // Person. `PersonVorschlag` kann hier nichts finden — beim Anlegen einer
    // neuen WEG entstehen alle Eigentümer in derselben Absendung, und wer zwei
    // Einheiten besitzt, bekam dadurch zwei getrennte Zugänge.
    const ownerSameAs = formData.getAll("wegOwnerSameAs").map((v) => String(v).trim());
    // Je Zeile die tatsächlich verwendete Person – Grundlage für die Verweise.
    const ownerResults: Array<{ id: string } | null> = [];
    const ownerCount = Math.min(ownerFirst.length, MAX_TENANTS);
    for (let i = 0; i < ownerCount; i++) {
      const oFirst = ownerFirst[i] ?? "";
      const oLast = ownerLast[i] ?? "";
      const oName = `${oFirst} ${oLast}`.trim();
      if (oName.length < 2) {
        // Der Platz in `ownerResults` muss stehen bleiben: Ein „gleich wie
        // Zeile 3" verweist auf den Formularindex, nicht auf die Zählung der
        // brauchbaren Zeilen.
        ownerResults.push(null);
        continue;
      }
      const unitId = ownerUnits[i] ? unitLabelToId.get(ownerUnits[i]) : undefined;
      if (!unitId) {
        ownerResults.push(null);
        continue; // ohne Einheit keine WEG-Eigentümerschaft
      }

      // „Dieselbe Person wie Zeile j" – dann keinen zweiten Zugang anlegen,
      // sondern die schon erzeugte Person erneut verknüpfen. Nur Rückverweise
      // auf frühere Zeilen sind gültig; alles andere fällt auf den Normalweg
      // zurück, statt still eine falsche Person zuzuordnen.
      const verweisRoh = ownerSameAs[i] ?? "";
      const verweis = verweisRoh === "" ? -1 : Number.parseInt(verweisRoh, 10);
      const fruehere =
        Number.isInteger(verweis) && verweis >= 0 && verweis < i ? ownerResults[verweis] : null;

      const oEmailRaw = ownerEmails[i] ?? "";
      const result: { id: string; pw: string } | null = fruehere
        ? { id: fruehere.id, pw: "" } // ein Zugangsschreiben je Person, nicht je Einheit
        : await personFuerZeile(actor, ownerUserIds[i] ?? "", {
            name: oName,
            firstName: oFirst || null,
            lastName: oLast || null,
            email: oEmailRaw && oEmailRaw.includes("@") ? oEmailRaw : null,
            phone: ownerPhones[i] ? ownerPhones[i].slice(0, 50) : null,
            role: "EIGENTUEMER",
          });
      ownerResults.push(result ? { id: result.id } : null);
      if (result) {
        await db.unitOwnership
          .create({
            data: {
              organizationId: actor.organizationId,
              unitId,
              userId: result.id,
              sharePercent: ownerShares[i] ?? 100,
              validFrom: (() => {
                const roh = ownerSince[i] ?? "";
                const d = roh ? new Date(roh) : null;
                return d && !Number.isNaN(d.getTime()) ? d : new Date();
              })(),
            },
          })
          .catch(() => {});
        // Objektweite Eigentümerschaft (idempotent über Unique userId+propertyId)
        await db.ownership
          .create({ data: { userId: result.id, propertyId: property.id } })
          .catch(() => {});
        if (result.pw) letterUsers.push(result);
      }
    }
    // Stimmgewichte (voteUnits/MEA) aus der Einheiten-Eigentümerschaft ableiten.
    await syncOwnerVotingWeights(property.id);
  }

  // ── Mieter (optional, je eine Karte) ────────────────────────────────
  const tenantFirst = formData.getAll("tenantFirstName").map((v) => String(v).trim());
  const tenantLast = formData.getAll("tenantLastName").map((v) => String(v).trim());
  const tenantEmails = formData.getAll("tenantEmail").map((v) => String(v).trim().toLowerCase());
  const tenantPhones = formData.getAll("tenantPhone").map((v) => String(v).trim());
  const tenantUnits = formData.getAll("tenantUnit").map((v) => String(v).trim());
  // Im Vorschlag gewählte bestehende Person – indexgleich zu den Namensfeldern.
  const tenantUserIds = formData.getAll("tenantUserId").map((v) => String(v).trim());

  const tenantCount = Math.min(tenantFirst.length, MAX_TENANTS);
  for (let i = 0; i < tenantCount; i++) {
    const tFirst = tenantFirst[i] ?? "";
    const tLast = tenantLast[i] ?? "";
    const tName = `${tFirst} ${tLast}`.trim();
    if (tName.length < 2) continue;

    const tEmailRaw = tenantEmails[i] ?? "";
    const result = await personFuerZeile(actor, tenantUserIds[i] ?? "", {
      name: tName,
      firstName: tFirst || null,
      lastName: tLast || null,
      email: tEmailRaw && tEmailRaw.includes("@") ? tEmailRaw : null,
      phone: tenantPhones[i] ? tenantPhones[i].slice(0, 50) : null,
      role: "MIETER",
    });
    if (result) {
      const unitId = tenantUnits[i] ? unitLabelToId.get(tenantUnits[i]) : undefined;
      if (unitId) {
        await db.tenancy
          .create({ data: { userId: result.id, unitId } })
          .catch(() => {});
      }
      if (result.pw) letterUsers.push(result);
    }
  }

  revalidatePath("/verwaltung/objekte");
  revalidatePath("/verwaltung/nutzer");

  // Falls Zugangsschreiben gedruckt werden müssen: Batch-Seite öffnen.
  // Die Passwörter reisen nicht mehr in der Adresszeile mit (`?u=id~pw~id~pw`) —
  // ein ganzes Objekt voller Klartext-Passwörter in einer URL stand in jedem
  // Zugriffsprotokoll auf dem Weg dorthin.
  if (letterUsers.length > 0) {
    await merkeErstzugaenge(letterUsers.map((l) => ({ id: l.id, pw: l.pw! })));
    redirect("/zugangsschreiben/batch");
  }

  redirect("/verwaltung/objekte?eingerichtet=1");
}
