/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `AccessCode` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AccessCode_status_expiresAt_idx";

-- AlterTable
ALTER TABLE "AccessCode" DROP COLUMN "expiresAt",
ADD COLUMN     "reservationExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AccessCode_status_reservationExpiresAt_idx" ON "AccessCode"("status", "reservationExpiresAt");
