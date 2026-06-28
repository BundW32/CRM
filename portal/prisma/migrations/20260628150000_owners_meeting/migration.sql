-- WEG Stufe 3: Eigentümerversammlung (light) – Versammlung + Tagesordnung
CREATE TYPE "MeetingStatus" AS ENUM ('GEPLANT', 'EINBERUFEN', 'DURCHGEFUEHRT', 'ABGESAGT');
CREATE TYPE "AgendaItemType" AS ENUM ('INFO', 'BESCHLUSS');

CREATE TABLE "OwnersMeeting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'GEPLANT',
    "invitationSentAt" TIMESTAMP(3),
    "protocolDocumentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OwnersMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AgendaItemType" NOT NULL DEFAULT 'INFO',
    "resolutionId" TEXT,
    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnersMeeting_organizationId_idx" ON "OwnersMeeting"("organizationId");
CREATE INDEX "OwnersMeeting_propertyId_idx" ON "OwnersMeeting"("propertyId");
CREATE INDEX "MeetingAgendaItem_meetingId_idx" ON "MeetingAgendaItem"("meetingId");

ALTER TABLE "OwnersMeeting" ADD CONSTRAINT "OwnersMeeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnersMeeting" ADD CONSTRAINT "OwnersMeeting_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnersMeeting" ADD CONSTRAINT "OwnersMeeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "OwnersMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "Resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
