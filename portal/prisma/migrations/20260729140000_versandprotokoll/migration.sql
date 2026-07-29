-- Versandprotokoll für ausgehende E-Mails.
CREATE TABLE "MailLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "userId" TEXT,
    "subject" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MailLog_organizationId_createdAt_idx" ON "MailLog"("organizationId", "createdAt");
CREATE INDEX "MailLog_userId_idx" ON "MailLog"("userId");
CREATE INDEX "MailLog_purpose_idx" ON "MailLog"("purpose");

ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull: Nach einer DSGVO-Löschung bleibt der Protokolleintrag bestehen (der
-- Versand hat stattgefunden), verliert aber den Personenbezug.
ALTER TABLE "MailLog" ADD CONSTRAINT "MailLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
