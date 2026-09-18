/** Shared vocabulary and privacy projection for the page AND exports. */
export const auditActionLabels: Record<string, string> = {
  RECORD_INSERT: "Angelegt", RECORD_UPDATE: "Geändert", RECORD_DELETE: "Gelöscht",
  LOGIN_SUCCESS: "Anmeldung erfolgreich", LOGIN_FAILED: "Anmeldung fehlgeschlagen",
  PASSWORD_RESET_REQUEST: "Passwort-Zurücksetzung angefordert",
  MFA_ENABLED: "Zweiter Faktor aktiviert", MFA_DISABLED: "Zweiter Faktor deaktiviert",
  MFA_FAILED: "Zweiter Faktor fehlgeschlagen", MFA_RECOVERY_USED: "Wiederherstellungscode verwendet",
  USER_ANONYMIZED: "Nutzer anonymisiert", EMAIL_CHANGE_REQUESTED: "E-Mail-Wechsel angefordert",
  EMAIL_CHANGE_CONFIRMED: "E-Mail-Wechsel bestätigt", EMAIL_CHANGE_ABORTED: "E-Mail-Wechsel abgebrochen",
  TICKET_CLOSED: "Vorgang geschlossen", TICKET_REOPENED: "Vorgang wieder geöffnet",
  TICKET_EXTERNAL_RELEASED: "Externe Beauftragung freigegeben",
  CRAFTSMAN_LINK_ROTATED: "Handwerker-Zugang erneuert", CRAFTSMAN_LINK_REVOKED: "Handwerker-Zugang widerrufen",
  DSGVO_EXPORT: "Personenbezogene Daten exportiert", AUDIT_EXPORTED: "Protokoll exportiert",
  AUDIT_HOLD_SET: "Aufbewahrungssperre gesetzt",
  CERT_MANDATE_GRANTED: "Bescheinigungsvollmacht erteilt", CERT_MANDATE_REVOKED: "Bescheinigungsvollmacht widerrufen",
  CERTIFICATE_GENERATED: "Bescheinigung erstellt", PLATFORM_ACCESS: "Plattformzugriff",
  PLATFORM_ORG_DEACTIVATED: "Organisation deaktiviert", PLATFORM_ORG_REACTIVATED: "Organisation reaktiviert",
  PLATFORM_ORG_PLAN_CHANGED: "Tarif geändert", PLATFORM_TRIAL_EXTENDED: "Testphase verlängert",
  PLATFORM_NOTE_SAVED: "Plattformnotiz gespeichert", PLATFORM_INVOICE_CREATED: "Plattformrechnung erstellt",
  PLATFORM_INVOICE_STATUS: "Rechnungsstatus geändert", PLATFORM_INVOICE_DOWNLOADED: "Plattformrechnung heruntergeladen",
  PLATFORM_INVOICE_SENT: "Plattformrechnung gesendet", PLATFORM_INVOICE_REMINDER: "Zahlungserinnerung gesendet",
  PLATFORM_IMPERSONATE_START: "Support-Stellvertretung begonnen", PLATFORM_IMPERSONATE_STOP: "Support-Stellvertretung beendet",
  WEG_FINANCE_SETTINGS_SAVED: "Finanzeinstellungen gespeichert", WEG_UNIT_SAVED: "Einheit gespeichert",
  WEG_COSTTYPE_SAVED: "Kostenart gespeichert", WEG_COST_CATALOG_ADOPTED: "Kostenartenkatalog übernommen",
  WEG_ACCOUNT_SAVED: "Konto gespeichert", WEG_BOOKING_CREATED: "Buchung erstellt",
  WEG_TRANSFER_CREATED: "Umbuchung erstellt", WEG_BANK_IMPORT: "Bankumsätze importiert",
  WEG_BANK_IMPORT_UNDONE: "Bankimport zurückgenommen", WEG_BOOKING_COSTTYPE_ASSIGNED: "Kostenart zugeordnet",
  WEG_BOOKING_REVERSED: "Buchung storniert", WEG_BOOKING_LABOR_SHARE_SET: "Lohnanteil geändert",
  WEG_STATEMENT_DOCUMENTS_RETRIED: "Abrechnungsdokumente erneut erstellt",
  WEG_DUE_POSTINGS_EXTENDED: "Sollstellungen fortgeschrieben", WEG_PLAN_SAVED: "Wirtschaftsplan gespeichert",
  WEG_PLAN_DELETED: "Wirtschaftsplan gelöscht", WEG_PLAN_RESOLVED: "Wirtschaftsplan beschlossen",
  WEG_PLAN_DOCUMENTS_RETRIED: "Plandokumente erneut erstellt", WEG_PAYMENT_ASSIGNED: "Zahlung zugeordnet",
  WEG_PAYMENT_ALLOCATED: "Zahlung auf Sollstellungen verteilt", WEG_PAYMENT_ALLOCATION_CLEARED: "Zahlungsverteilung aufgehoben",
  WEG_UNIT_OWNERSHIP_SAVED: "Eigentumsverhältnis gespeichert", WEG_STATEMENT_SAVED: "Jahresabrechnung gespeichert",
  WEG_STATEMENT_DELETED: "Jahresabrechnung gelöscht", WEG_STATEMENT_FINALIZED: "Jahresabrechnung abgeschlossen",
  WEG_MAHNUNG_CREATED: "Mahnung erstellt", WEG_MAHNUNG_SENT: "Mahnung versandt", WEG_MAHNUNG_DELETED: "Mahnung gelöscht",
  WEG_SONDERUMLAGE_CREATED: "Sonderumlage erstellt", WEG_SONDERUMLAGE_DELETED: "Sonderumlage gelöscht",
  WEG_PRUEFPFLICHT_CATALOG_ADOPTED: "Prüfpflichtenkatalog übernommen", WEG_PRUEFPFLICHT_COMPLETED: "Prüfpflicht erledigt",
  WEG_PRUEFPFLICHT_DELETED: "Prüfpflicht gelöscht", WEG_MEETING_INVITE_SENT: "Versammlungseinladung versandt",
  WEG_MEETING_INVITE_MARKED: "Versammlungseinladung als versandt markiert",
  WEG_MEASURE_SAVED: "Erhaltungsmaßnahme gespeichert", WEG_MEASURE_DELETED: "Erhaltungsmaßnahme gelöscht",
  WEG_VERBINDLICHKEIT_SAVED: "Verbindlichkeit gespeichert", WEG_VERBINDLICHKEIT_SETTLED: "Verbindlichkeit erledigt",
  WEG_VERBINDLICHKEIT_DELETED: "Verbindlichkeit gelöscht", WEG_VERBINDLICHKEIT_IMPORTED: "Verbindlichkeiten importiert",
  WEG_BAUABZUG_ANGEMELDET: "Bauabzugsteuer angemeldet", INTEGRATION_SAVED: "Integration gespeichert",
  INTEGRATION_CLEARED: "Integration entfernt", WEG_SEPA_MANDATE_SAVED: "SEPA-Mandat gespeichert",
  WEG_SEPA_MANDATE_DELETED: "SEPA-Mandat gelöscht", WEG_SEPA_EXPORT: "SEPA-Datei exportiert",
  WEG_CO2_SAVED: "CO₂-Aufteilung gespeichert", WEG_CO2_DELETED: "CO₂-Aufteilung gelöscht",
  WEG_BK_PREPAYMENT_SAVED: "Betriebskostenvorauszahlung gespeichert", WEG_BK_STATEMENT_EXPORTED: "Betriebskostenabrechnung exportiert",
  HANDWERKER_INVOICE_SUBMITTED: "Handwerkerrechnung eingereicht", HANDWERKER_INVOICE_ACCEPTED: "Handwerkerrechnung angenommen",
  HANDWERKER_INVOICE_REJECTED: "Handwerkerrechnung abgelehnt",
};

export const auditTargetLabels: Record<string, string> = {
  Booking: "Buchung", CostType: "Kostenart", LedgerAccount: "Konto", BankImportBatch: "Bankimport",
  Meter: "Zähler", MeterReading: "Zählerstand", OwnerMotion: "Eigentümerantrag", BeiratTask: "Beiratsaufgabe",
  EconomicPlan: "Wirtschaftsplan", EconomicPlanItem: "Planposition", AnnualStatement: "Jahresabrechnung",
  StatementUnitAmount: "Einzelverteilung", StatementAccountCheck: "Kontenabgleich", DuePosting: "Sollstellung",
  PaymentAllocation: "Zahlungszuordnung", UnitOwnership: "Eigentumsverhältnis", Property: "Objekt",
  Unit: "Einheit", Ownership: "Eigentümerzuordnung", Tenancy: "Mietverhältnis", HausgeldMahnung: "Mahnung",
  Sonderumlage: "Sonderumlage", Verbindlichkeit: "Verbindlichkeit", SepaMandate: "SEPA-Mandat",
  Co2Allocation: "CO₂-Aufteilung", MaintenanceMeasure: "Erhaltungsmaßnahme", MaintenanceTask: "Prüfpflicht",
  Resolution: "Beschluss", ResolutionVote: "Stimme", OwnersMeeting: "Versammlung", MeetingAgendaItem: "Tagesordnungspunkt",
  Document: "Dokument", DocumentRecipient: "Dokumentempfänger", Ticket: "Vorgang", CraftsmanInvoice: "Handwerkerrechnung",
  User: "Nutzer", PropertyAssignment: "Objektberechtigung", CraftsmanAssignment: "Handwerkerberechtigung",
  IntegrationSetting: "Integration", Organization: "Organisation", PlatformInvoice: "Plattformrechnung", AuditLog: "Audit-Log",
};

export const auditFieldLabels: Record<string, string> = {
  name: "Name", title: "Titel", label: "Bezeichnung", kind: "Art", status: "Status", category: "Kategorie",
  level: "Mahnstufe", paymentDeadline: "Zahlungsfrist", type: "Typ",
  meterId: "Zähler-ID", value: "Zählerstand", readingDate: "Ablesedatum", meterNumber: "Zählernummer", location: "Ort", remoteReadable: "Fernablesbar",
  amountCents: "Betrag", totalAmountCents: "Gesamtbetrag", laborShareCents: "Lohnanteil", text: "Buchungstext",
  reference: "Referenz", bookingDate: "Buchungstag", valueDate: "Wertstellung", costTypeId: "Kostenart-ID",
  accountId: "Konto-ID", unitId: "Einheiten-ID", propertyId: "Objekt-ID", userId: "Nutzer-ID",
  organizationId: "Organisations-ID", reversalOfId: "Stornierte Buchung", transferGroupId: "Umbuchungsgruppe",
  transferOut: "Abgang", importBatchId: "Bankimport-ID", distributionKey: "Verteilerschlüssel",
  active: "Aktiv", year: "Jahr", resolvedAt: "Beschlossen am", validFrom: "Gültig ab", validTo: "Gültig bis",
  validUntil: "Gültig bis", finalizedAt: "Abgeschlossen am", dueDate: "Fälligkeit", planId: "Plan-ID",
  statementId: "Abrechnungs-ID", openingBalanceCents: "Anfangsbestand", openingBalanceDate: "Anfangsbestand zum",
  reportedEndCents: "Endbestand laut Kontoauszug", previousActualCents: "Vorjahres-Ist",
  sharePercent: "Eigentumsanteil (%)", mea: "Miteigentumsanteile", meaTotal: "MEA gesamt", livingArea: "Wohnfläche (m²)",
  unitType: "Einheitentyp", personCount: "Personenzahl", fiscalYearStartMonth: "Beginn Wirtschaftsjahr",
  votingPrinciple: "Stimmprinzip", managementType: "Verwaltungsart", isBoardMember: "Beirat",
  role: "Rolle", isSuperAdmin: "Organisationsadministrator", isPlatformAdmin: "Plattformadministrator",
  passwordChanged: "Passwort geändert", ibanChanged: "IBAN geändert", bicChanged: "BIC geändert",
  secretEncChanged: "Zugangsdaten geändert", configJsonChanged: "Konfiguration geändert",
  snapshotChanged: "Abrechnungsstand geändert", storedNameChanged: "Datei geändert",
  belegStoredNameChanged: "Beleg geändert", proofStoredNameChanged: "Nachweis geändert",
  contractStoredNameChanged: "Vertragsdatei geändert", emailChanged: "E-Mail geändert", nameChanged: "Name geändert",
  phoneChanged: "Telefon geändert", streetChanged: "Straße geändert", zipChanged: "PLZ geändert", cityChanged: "Ort geändert",
  actorKind: "Herkunft", count: "Anzahl", format: "Format", view: "Ansicht", rows: "Zeilen",
  fileName: "Dateiname", belegFileName: "Belegname", proofFileName: "Nachweisname",
  source: "Quelle", beiratReviewStatus: "Beiratsprüfung", rowsImported: "Importierte Zeilen", rowsSkipped: "Übersprungene Zeilen",
  debtorName: "Zahlungspflichtiger", periodYear: "Solljahr", periodMonth: "Sollmonat", duePostingId: "Sollstellungs-ID",
  feeCents: "Gebühr", interestCents: "Zinsen", arrearsCents: "Rückstand", estimatedCents: "Geschätzte Kosten",
  totalCo2Cents: "CO₂-Kosten", bauabzugCents: "Bauabzugsteuer", bkPrepaymentMonthlyCents: "Betriebskostenvorauszahlung",
  dueDayOfMonth: "Fälligkeitstag", dueDayRule: "Fälligkeitsregel", mahnkostenCents: "Mahnkosten", hausgeldRounding: "Hausgeldrundung",
  laborShareType: "Lohnanteilsart", laborSharePercent: "Lohnanteil (%)", heatingCost: "Heizkosten",
  heatingConsumptionPercent: "Verbrauchsanteil (%)", constructionWork: "Bauleistung", recoverableBetrKV: "Umlagefähig",
  done: "Erledigt", targetYear: "Zieljahr", trade: "Gewerk", number: "Nummer", description: "Beschreibung",
  priority: "Priorität", deadline: "Frist", majority: "Mehrheit", choice: "Stimme", sortOrder: "Reihenfolge",
  scheduledAt: "Termin", decidedAt: "Beschlossen am", sentAt: "Versandt am", invitationSentAt: "Einladung versandt am",
  protocolGeneratedAt: "Protokoll erstellt am", closedAt: "Geschlossen am", externalReleasedAt: "Extern freigegeben am",
  settledAt: "Erledigt am", incurredOn: "Entstanden am", reviewedAt: "Geprüft am", lastDoneAt: "Zuletzt erledigt am",
  startDate: "Beginn", endDate: "Ende", signedDate: "Unterzeichnet am", mandateRef: "Mandatsreferenz",
  sequence: "Lastschriftfolge", audience: "Sichtbarkeit", meetingId: "Versammlungs-ID", resolutionId: "Beschluss-ID",
  documentId: "Dokument-ID", ticketId: "Vorgangs-ID", bookingId: "Buchungs-ID", craftsmanId: "Handwerker-ID",
  assignedToId: "Zuständiger (ID)", castByUserId: "Vertreter (ID)", sonderumlageId: "Sonderumlagen-ID",
  emissionsKg: "CO₂-Ausstoß (kg)", interval: "Intervall", orderIndex: "Sortierung", floor: "Etage",
  stellplatzTyp: "Stellplatztyp", voteUnits: "Stimmen", provider: "Anbieter", enabled: "Aktiviert",
  accountType: "Kontotyp", plan: "Tarif", subscriptionStatus: "Abonnementstatus", resolutionNote: "Beschlussvermerk",
  sessionsValidFrom: "Sitzungen gültig ab", anonymizedAt: "Anonymisiert am", totpEnabledAt: "Authenticator aktiviert am",
  mfaEmailEnabledAt: "E-Mail-Zweitfaktor aktiviert am", bauabzugAngemeldetAt: "Bauabzug angemeldet am",
};

// Owner access is intentionally a positive list of community-level data, not
// "all JOURNAL": no individual balances, mandates, votes or recipient lists.
export const ownerJournalFields: Record<string, readonly string[]> = {
  Property: ["name", "meaTotal", "managementType", "votingPrinciple", "fiscalYearStartMonth", "hausgeldRounding"],
  CostType: ["name", "category", "distributionKey", "laborShareType", "laborSharePercent", "heatingCost", "heatingConsumptionPercent", "recoverableBetrKV", "active"],
  LedgerAccount: ["name", "kind", "openingBalanceCents", "openingBalanceDate", "active"],
  EconomicPlan: ["year", "status", "resolvedAt", "validFrom", "validUntil", "hausgeldRounding", "beiratReviewStatus"],
  EconomicPlanItem: ["planId", "costTypeId", "amountCents", "previousActualCents"],
  AnnualStatement: ["year", "status", "finalizedAt", "beiratReviewStatus"],
  Sonderumlage: ["title", "totalAmountCents", "distributionKey", "dueDate"],
  Co2Allocation: ["year", "totalCo2Cents", "emissionsKg"],
  MaintenanceMeasure: ["title", "trade", "targetYear", "estimatedCents", "done"],
};

const metaKeys = new Set(["organizationId", "propertyId", "unitId", "count", "format", "view", "rows", "from", "to", "plan", "subscriptionStatus", "amountCents", "year", "number", "imported", "skipped", "created", "deleted", "accountChecks", "manualCostType", "meterDistributedCostType", "meterType", "consumptionPercent", "reason"]);
/** Apply to legacy data on READ too: old rows can contain email/IP/token copies. */
export function safeAuditMeta(value: unknown, depth = 0): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 2) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => metaKeys.has(key)).map(([key, val]) =>
    [key, val && typeof val === "object" ? safeAuditMeta(val, depth + 1) : typeof val === "string" ? val.slice(0, 500) : val]));
}

export type AuditChange = { field: string; before: unknown; after: unknown; beforeLabel?: string; afterLabel?: string };
export function auditChanges(value: unknown, target: string | null, owner: boolean): AuditChange[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const allowed = owner ? ownerJournalFields[target ?? ""] ?? [] : Object.keys(auditFieldLabels);
  return Object.entries(value).flatMap(([field, change]) => {
    if (!allowed.includes(field) || !change || typeof change !== "object" || Array.isArray(change)) return [];
    const pair = change as Record<string, unknown>;
    return [{ field, before: pair.before ?? null, after: pair.after ?? null,
      ...(typeof pair.beforeLabel === "string" ? { beforeLabel: pair.beforeLabel } : {}),
      ...(typeof pair.afterLabel === "string" ? { afterLabel: pair.afterLabel } : {}),
    }];
  });
}

export function auditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number" && field.endsWith("Cents")) return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100);
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function auditTimestamp(date: Date): string {
  return date.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Inclusive Berlin calendar dates, including 23/25-hour DST days. */
export function auditDayBoundary(value: string | undefined, next = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return;
  if (next) date.setUTCDate(date.getUTCDate() + 1);
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value;
  const hours = Number(offset?.match(/GMT\+(\d+)/)?.[1]);
  if (!hours) return;
  return new Date(date.getTime() - hours * 3_600_000);
}

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // Spreadsheet formula injection, including leading whitespace/control chars.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
