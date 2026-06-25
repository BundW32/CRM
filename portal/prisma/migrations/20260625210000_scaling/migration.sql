-- Skalierungs-Indizes: häufige Query-Muster werden von Full-Table-Scans auf
-- Index-Scans umgestellt. Besonders relevant für größere Portfolios (1.000+
-- Einheiten, 100+ Handwerker).

-- Craftsman: bisher keinerlei Indizes
CREATE INDEX "Craftsman_active_trade_idx" ON "Craftsman"("active", "trade");
CREATE INDEX "Craftsman_email_idx" ON "Craftsman"("email");

-- User: compound-Index für "aktive Nutzer einer Rolle" (häufigste Verwalter-Abfrage)
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- Ticket: Typ- und Prioritäts-Filter (Listen, Triage, Berichte)
CREATE INDEX "Ticket_type_idx" ON "Ticket"("type");
CREATE INDEX "Ticket_priority_idx" ON "Ticket"("priority");

-- MaintenanceTask: aktive + fällige Aufgaben (Dashboard-Kennzahl, Wartungsliste)
CREATE INDEX "MaintenanceTask_active_dueDate_idx" ON "MaintenanceTask"("active", "dueDate");
