-- Optionale Einschränkung der für einen Verwalter sichtbaren Handwerker.
CREATE TABLE "CraftsmanAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "craftsmanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CraftsmanAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CraftsmanAssignment"
    ADD CONSTRAINT "CraftsmanAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CraftsmanAssignment"
    ADD CONSTRAINT "CraftsmanAssignment_craftsmanId_fkey"
    FOREIGN KEY ("craftsmanId") REFERENCES "Craftsman"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CraftsmanAssignment_userId_craftsmanId_key"
    ON "CraftsmanAssignment"("userId", "craftsmanId");
