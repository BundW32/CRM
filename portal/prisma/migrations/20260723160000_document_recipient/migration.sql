-- Gezielte Empfaenger eines Dokuments (1:1-Freigabe an bestimmte Personen).
CREATE TABLE "DocumentRecipient" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRecipient_documentId_userId_key" ON "DocumentRecipient"("documentId", "userId");
CREATE INDEX "DocumentRecipient_userId_idx" ON "DocumentRecipient"("userId");

ALTER TABLE "DocumentRecipient" ADD CONSTRAINT "DocumentRecipient_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentRecipient" ADD CONSTRAINT "DocumentRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
