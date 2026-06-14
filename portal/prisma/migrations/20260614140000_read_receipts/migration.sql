-- Lesebestätigung für Dokumente und Aushänge
CREATE TABLE "Acknowledgement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentId" TEXT,
  "announcementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Acknowledgement_userId_documentId_key" ON "Acknowledgement"("userId", "documentId");
CREATE UNIQUE INDEX "Acknowledgement_userId_announcementId_key" ON "Acknowledgement"("userId", "announcementId");

ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
