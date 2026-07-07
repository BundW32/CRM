-- SLA-Fälligkeitsdatum: wird aus der Priorität beim Erstellen eines Vorgangs
-- berechnet; bei Prioritätsänderung relativ zum Änderungszeitpunkt neu gesetzt.
ALTER TABLE "Ticket" ADD COLUMN "dueAt" TIMESTAMP(3);
CREATE INDEX "Ticket_dueAt_idx" ON "Ticket"("dueAt");

-- Herkunft: Vorgang aus einer Wartungsaufgabe erzeugt (Rückverfolgung)
ALTER TABLE "Ticket" ADD COLUMN "sourceMaintenanceTaskId" TEXT;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sourceMaintenanceTaskId_fkey"
  FOREIGN KEY ("sourceMaintenanceTaskId") REFERENCES "MaintenanceTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Ticket_sourceMaintenanceTaskId_idx" ON "Ticket"("sourceMaintenanceTaskId");
