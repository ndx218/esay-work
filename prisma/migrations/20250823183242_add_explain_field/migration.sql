/*
  Warnings:

  - A unique constraint covering the columns `[outlineId,doi]` on the table `Reference` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Reference_doi_key";

-- DropIndex
DROP INDEX "public"."Transaction_userId_idx";

-- AlterTable
ALTER TABLE "public"."Reference" ADD COLUMN     "explain" TEXT;

-- CreateIndex
CREATE INDEX "Reference_doi_idx" ON "public"."Reference"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Reference_outlineId_doi_key" ON "public"."Reference"("outlineId", "doi");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "public"."Transaction"("userId", "createdAt");
