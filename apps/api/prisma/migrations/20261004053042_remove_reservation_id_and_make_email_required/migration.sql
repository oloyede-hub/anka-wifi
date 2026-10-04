/*
  Warnings:

  - You are about to drop the column `reservationId` on the `AccessCode` table. All the data in the column will be lost.
  - Made the column `email` on table `Customer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "AccessCode_reservationId_key";

-- AlterTable
ALTER TABLE "AccessCode" DROP COLUMN "reservationId";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "email" SET NOT NULL;
