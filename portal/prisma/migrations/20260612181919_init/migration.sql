-- CreateEnum
CREATE TYPE "Role" AS ENUM ('VERWALTER', 'EIGENTUEMER', 'MIETER', 'HANDWERKER');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SCHADEN', 'ANFRAGE', 'DOKUMENT_ANFRAGE', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEU', 'IN_BEARBEITUNG', 'BEAUFTRAGT', 'ERLEDIGT', 'GESCHLOSSEN');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('NIEDRIG', 'NORMAL', 'HOCH', 'DRINGEND');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('ABRECHNUNG', 'PROTOKOLL', 'VERTRAG', 'BESCHEINIGUNG', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('MIETER', 'EIGENTUEMER', 'ALLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "immoware24Id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "floor" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEU',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "audience" "Audience" NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "audience" "Audience" NOT NULL DEFAULT 'ALLE',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Property_immoware24Id_key" ON "Property"("immoware24Id");

-- CreateIndex
CREATE UNIQUE INDEX "Ownership_userId_propertyId_key" ON "Ownership"("userId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenancy_userId_unitId_key" ON "Tenancy"("userId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storedName_key" ON "Document"("storedName");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
