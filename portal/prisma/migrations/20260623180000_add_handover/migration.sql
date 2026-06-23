-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('EINZUG', 'AUSZUG', 'ZWISCHENZUSTAND');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('ENTWURF', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('WOHNZIMMER', 'SCHLAFZIMMER', 'KINDERZIMMER', 'KUECHE', 'BAD', 'GAESTE_WC', 'FLUR', 'ABSTELLRAUM', 'BALKON', 'TERRASSE', 'KELLER', 'GARAGE', 'BUERO', 'ESSZIMMER', 'GARDEROBE', 'HAUSWIRTSCHAFTSRAUM', 'SONSTIGES');

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "type" "HandoverType" NOT NULL DEFAULT 'EINZUG',
    "status" "HandoverStatus" NOT NULL DEFAULT 'ENTWURF',
    "handoverDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitId" TEXT NOT NULL,
    "tenantName" TEXT,
    "tenantEmail" TEXT,
    "tenantPhone" TEXT,
    "tenantAddress" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "managerName" TEXT,
    "managerEmail" TEXT,
    "managerPhone" TEXT,
    "keysApartment" INTEGER,
    "keysMailbox" INTEGER,
    "keysBasement" INTEGER,
    "keysGarage" INTEGER,
    "keysOther" TEXT,
    "parkingSpace" TEXT,
    "cellarSpace" TEXT,
    "generalNotes" TEXT,
    "agreements" TEXT,
    "checklist" JSONB,
    "tenantSignature" TEXT,
    "managerSignature" TEXT,
    "pdfStoredName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverRoom" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" "RoomType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "overallNote" TEXT,
    "wallsNote" TEXT,
    "ceilingNote" TEXT,
    "floorNote" TEXT,
    "windowsNote" TEXT,
    "doorsNote" TEXT,
    "heatingNote" TEXT,
    "sanitaryNote" TEXT,
    "otherNote" TEXT,

    CONSTRAINT "HandoverRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverPhoto" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "roomId" TEXT,
    "storedName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverMeter" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "meterNumber" TEXT,
    "reading" TEXT,
    "readingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoStoredName" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HandoverMeter_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverRoom" ADD CONSTRAINT "HandoverRoom_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverPhoto" ADD CONSTRAINT "HandoverPhoto_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverPhoto" ADD CONSTRAINT "HandoverPhoto_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HandoverRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverMeter" ADD CONSTRAINT "HandoverMeter_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;
