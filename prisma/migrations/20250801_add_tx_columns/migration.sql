-- Add columns to Transaction
ALTER TABLE "Transaction"
  ADD COLUMN "performedBy" TEXT,
  ADD COLUMN "idempotencyKey" TEXT;

-- Add unique index for idempotencyKey
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction" ("idempotencyKey");
