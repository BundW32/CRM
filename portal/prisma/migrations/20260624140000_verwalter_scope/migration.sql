-- Add isSuperAdmin flag to User
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Existing Verwalter keep full access (no disruption to live system)
UPDATE "User" SET "isSuperAdmin" = true WHERE role = 'VERWALTER';

-- PropertyAssignment: which Verwalter is responsible for which properties
CREATE TABLE "PropertyAssignment" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PropertyAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PropertyAssignment"
    ADD CONSTRAINT "PropertyAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyAssignment"
    ADD CONSTRAINT "PropertyAssignment_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PropertyAssignment_userId_propertyId_key"
    ON "PropertyAssignment"("userId", "propertyId");
