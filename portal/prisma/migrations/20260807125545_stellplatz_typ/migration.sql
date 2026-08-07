-- CreateEnum
CREATE TYPE "StellplatzTyp" AS ENUM ('AUSSENSTELLPLATZ', 'CARPORT', 'GARAGE', 'TIEFGARAGE');

-- DropForeignKey
ALTER TABLE "HandoverPhoto" DROP CONSTRAINT "HandoverPhoto_handoverId_fkey";

-- DropIndex
DROP INDEX "Craftsman_kind_idx";

-- AlterTable
ALTER TABLE "Co2Allocation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IntegrationSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "stellplatzTyp" "StellplatzTyp";
