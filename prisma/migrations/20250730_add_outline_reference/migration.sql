-- CreateTable Outline
CREATE TABLE "Outline" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Outline_pkey" PRIMARY KEY ("id")
);

-- Indexes for Outline
CREATE INDEX "Outline_userId_createdAt_idx" ON "Outline"("userId", "createdAt");

-- CreateTable Reference
CREATE TABLE "Reference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "outlineId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "doi" TEXT,
  "source" TEXT,
  "authors" TEXT,
  "publishedAt" TIMESTAMP(3),
  "type" TEXT NOT NULL DEFAULT 'OTHER',
  "summary" TEXT,
  "credibility" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- Indexes for Reference
CREATE INDEX "Reference_userId_outlineId_sectionKey_idx" ON "Reference"("userId", "outlineId", "sectionKey");
CREATE INDEX "Reference_type_credibility_idx" ON "Reference"("type", "credibility");

-- Constraints
ALTER TABLE "Outline"
  ADD CONSTRAINT "Outline_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reference"
  ADD CONSTRAINT "Reference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reference"
  ADD CONSTRAINT "Reference_outlineId_fkey"
  FOREIGN KEY ("outlineId") REFERENCES "Outline"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Uniques
CREATE UNIQUE INDEX "Reference_doi_key" ON "Reference"("doi");
CREATE UNIQUE INDEX "Reference_outlineId_url_key" ON "Reference"("outlineId", "url");
