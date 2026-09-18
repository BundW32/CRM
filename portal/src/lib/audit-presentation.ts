import { auditActionLabels, auditFieldLabels, auditTargetLabels, auditValue, type AuditChange } from "./audit-display";
import type { auditProjection } from "./audit-query";

export type AuditEvent = ReturnType<typeof auditProjection>;

export const auditAreas = {
  finances: { label: "Finanzen", targets: ["Booking", "CostType", "LedgerAccount", "BankImportBatch", "EconomicPlan", "EconomicPlanItem", "AnnualStatement", "StatementUnitAmount", "StatementAccountCheck", "DuePosting", "PaymentAllocation", "HausgeldMahnung", "Sonderumlage", "Verbindlichkeit", "SepaMandate", "Co2Allocation", "CraftsmanInvoice", "PlatformInvoice"] },
  documents: { label: "Dokumente", targets: ["Document", "DocumentRecipient"] },
  community: { label: "Gemeinschaft", targets: ["Property", "Unit", "UnitOwnership", "Ownership", "Tenancy", "Resolution", "ResolutionVote", "OwnersMeeting", "MeetingAgendaItem", "OwnerMotion", "BeiratTask"] },
  maintenance: { label: "Instandhaltung & Zähler", targets: ["MaintenanceMeasure", "MaintenanceTask", "Meter", "MeterReading", "Ticket"] },
  access: { label: "Zugänge & Einstellungen", targets: ["User", "PropertyAssignment", "CraftsmanAssignment", "IntegrationSetting", "Organization", "AuditLog"] },
} satisfies Record<string, { label: string; targets: string[] }>;

export function auditPerson(row: AuditEvent): string {
  if (row.actorKind === "UNKNOWN") return "Person nicht erfasst";
  if (row.actorKind === "SYSTEM") return "Systemprozess";
  if (row.actorKind === "SUPPORT") return row.actorName ? `${row.actorName} (Support)` : "Support";
  return row.actorName || (row.actorKind === "CRAFTSMAN" ? "Handwerker" : "Person nicht erfasst");
}

const objects: Record<string, string> = {
  Booking: "eine Buchung", CostType: "eine Kostenart", LedgerAccount: "ein Konto", BankImportBatch: "einen Bankimport",
  EconomicPlan: "einen Wirtschaftsplan", EconomicPlanItem: "eine Planposition", AnnualStatement: "eine Jahresabrechnung",
  Property: "ein Objekt", Unit: "eine Einheit", Document: "ein Dokument", Resolution: "einen Beschluss",
  OwnersMeeting: "eine Versammlung", Meter: "einen Zähler", MeterReading: "einen Zählerstand", User: "ein Nutzerkonto",
};

/** Fixed templates only. Never infer motives, success, or an unidentified actor. */
export function auditSentence(row: AuditEvent): string {
  const person = auditPerson(row);
  const verb = { INSERT: "angelegt", UPDATE: "geändert", DELETE: "gelöscht" }[row.operation ?? ""];
  if (verb) {
    if (person === "Person nicht erfasst") return `${auditTargetLabels[row.targetType ?? ""] ?? "Datensatz"} ${verb} · Person nicht erfasst.`;
    const object = objects[row.targetType ?? ""];
    if (object) return `${person} hat ${object} ${verb}.`;
    return `${person}: ${auditTargetLabels[row.targetType ?? ""] ?? "Datensatz"} ${verb}.`;
  }
  if (row.action === "LOGIN_SUCCESS") return `${person} hat sich angemeldet.`;
  if (row.action === "LOGIN_FAILED") return "Eine Anmeldung ist fehlgeschlagen.";
  return `${person}: ${auditActionLabels[row.action] ?? "Ereignis protokolliert"}.`;
}

export function auditGroupSentence(rows: AuditEvent[], count: number): string {
  const first = rows[0];
  if (!first) return "Keine Einträge";
  const plurals: Record<string, string> = { Booking: "Buchungen", EconomicPlanItem: "Planpositionen", Document: "Dokumente", DuePosting: "Sollstellungen" };
  const plural = plurals[first.targetType ?? ""];
  const person = auditPerson(first);
  if (rows.length === count && plural && person !== "Person nicht erfasst" && rows.every(r => r.operation === "INSERT" && r.targetType === first.targetType && r.targetId)
    && new Set(rows.map(r => r.targetId)).size === count) return `${person} hat ${count} ${plural} angelegt.`;
  return `${person}: ${count} zusammengehörige Einträge.`;
}

/** Only historical, already permission-projected values; no current data as a historical label. */
export function auditSubject(row: AuditEvent): string | null {
  const change = ["text", "title", "name", "label", "year"].map(field => row.changes.find(c => c.field === field)).find(Boolean);
  if (!change) return null;
  const value = row.operation === "DELETE" ? change.before : change.after;
  if (typeof value !== "string" && typeof value !== "number") return null;
  return `${change.field === "year" ? "Jahr " : ""}${String(value).slice(0, 180)}`;
}

export function auditChangeKind(change: AuditChange): string {
  if (change.field.endsWith("Changed")) return "Geändert";
  if (change.before == null && change.after != null) return "Ergänzt";
  if (change.after == null && change.before != null) return "Entfernt";
  return "Geändert";
}

export function auditFriendlyField(field: string): string {
  return (auditFieldLabels[field] ?? field).replace(/-ID$/, "").replace(/ \(ID\)$/, "");
}

export function auditFriendlyValue(change: AuditChange, side: "before" | "after"): string {
  const value = change[side];
  if (value == null) return "Nicht hinterlegt";
  const label = side === "before" ? change.beforeLabel : change.afterLabel;
  if (label) return label;
  if (change.field.endsWith("Id")) return "Verknüpfter Datensatz (Kennung unter technischen Angaben)";
  return auditValue(change.field, value);
}
