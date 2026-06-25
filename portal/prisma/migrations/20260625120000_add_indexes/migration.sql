-- Performanz-Indizes auf Fremdschlüssel-/Filterspalten.
-- PostgreSQL legt für Foreign Keys keine Indizes automatisch an; ohne diese
-- führen Filter nach propertyId/unitId/userId/ticketId etc. zu Sequential Scans
-- über die gesamte Tabelle. Bei großen Beständen (Zehntausende Einheiten,
-- entsprechend mehr Tickets/Mietverhältnisse/Zähler) ist das der zentrale
-- Skalierungsengpass. Alle Statements sind rein additiv.

CREATE INDEX "User_role_idx" ON "User"("role");

CREATE INDEX "PropertyAssignment_propertyId_idx" ON "PropertyAssignment"("propertyId");

CREATE INDEX "CraftsmanAssignment_craftsmanId_idx" ON "CraftsmanAssignment"("craftsmanId");

CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

CREATE INDEX "Meter_unitId_idx" ON "Meter"("unitId");
CREATE INDEX "Meter_propertyId_idx" ON "Meter"("propertyId");

CREATE INDEX "MeterReading_meterId_idx" ON "MeterReading"("meterId");

CREATE INDEX "Ownership_propertyId_idx" ON "Ownership"("propertyId");

CREATE INDEX "Tenancy_unitId_idx" ON "Tenancy"("unitId");

CREATE INDEX "Ticket_propertyId_idx" ON "Ticket"("propertyId");
CREATE INDEX "Ticket_unitId_idx" ON "Ticket"("unitId");
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");
CREATE INDEX "Ticket_assignedToId_idx" ON "Ticket"("assignedToId");
CREATE INDEX "Ticket_craftsmanId_idx" ON "Ticket"("craftsmanId");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");

CREATE INDEX "TicketComment_ticketId_idx" ON "TicketComment"("ticketId");

CREATE INDEX "Attachment_ticketId_idx" ON "Attachment"("ticketId");
CREATE INDEX "Attachment_commentId_idx" ON "Attachment"("commentId");

CREATE INDEX "Document_propertyId_idx" ON "Document"("propertyId");
CREATE INDEX "Document_unitId_idx" ON "Document"("unitId");

CREATE INDEX "Announcement_propertyId_idx" ON "Announcement"("propertyId");

CREATE INDEX "Acknowledgement_documentId_idx" ON "Acknowledgement"("documentId");
CREATE INDEX "Acknowledgement_announcementId_idx" ON "Acknowledgement"("announcementId");

CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

CREATE INDEX "MaintenanceTask_propertyId_idx" ON "MaintenanceTask"("propertyId");
CREATE INDEX "MaintenanceTask_dueDate_idx" ON "MaintenanceTask"("dueDate");

CREATE INDEX "Resolution_propertyId_idx" ON "Resolution"("propertyId");

CREATE INDEX "Handover_unitId_idx" ON "Handover"("unitId");

CREATE INDEX "HandoverRoom_handoverId_idx" ON "HandoverRoom"("handoverId");

CREATE INDEX "HandoverPhoto_roomId_idx" ON "HandoverPhoto"("roomId");

CREATE INDEX "HandoverMeter_handoverId_idx" ON "HandoverMeter"("handoverId");

CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

CREATE INDEX "Note_propertyId_idx" ON "Note"("propertyId");
CREATE INDEX "Note_unitId_idx" ON "Note"("unitId");
CREATE INDEX "Note_targetUserId_idx" ON "Note"("targetUserId");
CREATE INDEX "Note_pinned_idx" ON "Note"("pinned");
