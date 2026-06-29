-- Eigentümer-Antrag (Selbstverwaltung Stufe B)
CREATE TYPE "MotionType" AS ENUM ('BESCHLUSSANTRAG', 'VERSAMMLUNG');
CREATE TYPE "MotionStatus" AS ENUM ('EINGEREICHT', 'UEBERNOMMEN', 'ABGELEHNT');

CREATE TABLE "OwnerMotion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MotionType" NOT NULL DEFAULT 'BESCHLUSSANTRAG',
    "status" "MotionStatus" NOT NULL DEFAULT 'EINGEREICHT',
    "decisionNote" TEXT,
    "resolutionId" TEXT,
    "meetingId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerMotion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnerMotion_organizationId_idx" ON "OwnerMotion"("organizationId");
CREATE INDEX "OwnerMotion_propertyId_idx" ON "OwnerMotion"("propertyId");
CREATE INDEX "OwnerMotion_submittedById_idx" ON "OwnerMotion"("submittedById");

ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "Resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "OwnersMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OwnerMotion" ADD CONSTRAINT "OwnerMotion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
