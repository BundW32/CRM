-- CreateEnum
CREATE TYPE "VerwalterAnfrageStatus" AS ENUM ('OFFEN', 'BEANTWORTET', 'GESCHLOSSEN');

-- CreateTable
CREATE TABLE "VerwalterAnfrage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VerwalterAnfrageStatus" NOT NULL DEFAULT 'OFFEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerwalterAnfrage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerwalterAnfrageNachricht" (
    "id" TEXT NOT NULL,
    "anfrageId" TEXT NOT NULL,
    "vomBetreiber" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerwalterAnfrageNachricht_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerwalterAnfrage_number_key" ON "VerwalterAnfrage"("number");

-- CreateIndex
CREATE INDEX "VerwalterAnfrage_organizationId_status_idx" ON "VerwalterAnfrage"("organizationId", "status");

-- CreateIndex
CREATE INDEX "VerwalterAnfrage_status_updatedAt_idx" ON "VerwalterAnfrage"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "VerwalterAnfrageNachricht_anfrageId_createdAt_idx" ON "VerwalterAnfrageNachricht"("anfrageId", "createdAt");

-- AddForeignKey
ALTER TABLE "VerwalterAnfrage" ADD CONSTRAINT "VerwalterAnfrage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerwalterAnfrage" ADD CONSTRAINT "VerwalterAnfrage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerwalterAnfrageNachricht" ADD CONSTRAINT "VerwalterAnfrageNachricht_anfrageId_fkey" FOREIGN KEY ("anfrageId") REFERENCES "VerwalterAnfrage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerwalterAnfrageNachricht" ADD CONSTRAINT "VerwalterAnfrageNachricht_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

