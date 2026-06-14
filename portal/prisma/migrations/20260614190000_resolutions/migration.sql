-- WEG-Umlaufbeschlüsse mit digitaler Abstimmung
CREATE TYPE "ResolutionStatus" AS ENUM ('OFFEN', 'ANGENOMMEN', 'ABGELEHNT', 'ZURUECKGEZOGEN');
CREATE TYPE "VoteChoice" AS ENUM ('JA', 'NEIN', 'ENTHALTUNG');

CREATE TABLE "Resolution" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "number" INTEGER,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ResolutionStatus" NOT NULL DEFAULT 'OFFEN',
  "deadline" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "Resolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResolutionVote" (
  "id" TEXT NOT NULL,
  "resolutionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "choice" "VoteChoice" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResolutionVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResolutionVote_resolutionId_userId_key" ON "ResolutionVote"("resolutionId", "userId");

ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResolutionVote" ADD CONSTRAINT "ResolutionVote_resolutionId_fkey"
  FOREIGN KEY ("resolutionId") REFERENCES "Resolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolutionVote" ADD CONSTRAINT "ResolutionVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
