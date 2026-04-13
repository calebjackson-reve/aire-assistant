-- TCS Flagship: stage enum additions + TCSSession/TCSQuestion + Brokerage multi-tenant
-- NOTE: this baseline captures schema that was originally applied via `prisma db push`.
--       It is safe to run on a fresh DB; on the Neon DB that was already pushed it is
--       marked as applied via `prisma migrate resolve --applied`.

-- AlterEnum: add UNDER_CONTRACT and POST_CLOSE to TransactionStatus
-- Postgres requires ALTER TYPE ADD VALUE to run outside a transaction; each value in its own statement.
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'UNDER_CONTRACT';
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'POST_CLOSE';

-- CreateTable: TCSSession
CREATE TABLE IF NOT EXISTS "TCSSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "side" TEXT NOT NULL,
    "currentStage" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "silentActions" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TCSSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TCSSession_userId_createdAt_idx" ON "TCSSession"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TCSSession_transactionId_idx" ON "TCSSession"("transactionId");

-- CreateTable: TCSQuestion
CREATE TABLE IF NOT EXISTS "TCSQuestion" (
    "id" TEXT NOT NULL,
    "stage" "TransactionStatus" NOT NULL,
    "key" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "quickReplies" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "orderHint" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TCSQuestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TCSQuestion_key_key" ON "TCSQuestion"("key");
CREATE INDEX IF NOT EXISTS "TCSQuestion_stage_orderHint_idx" ON "TCSQuestion"("stage", "orderHint");

-- CreateTable: Brokerage
CREATE TABLE IF NOT EXISTS "Brokerage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryContact" TEXT,
    "billingEmail" TEXT,
    "seatCount" INTEGER NOT NULL DEFAULT 1,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brokerage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Brokerage_slug_key" ON "Brokerage"("slug");

-- CreateTable: Team
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "brokerageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderUserId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Team_brokerageId_idx" ON "Team"("brokerageId");

-- CreateTable: BrokerageMember
CREATE TABLE IF NOT EXISTS "BrokerageMember" (
    "id" TEXT NOT NULL,
    "brokerageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "teamId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerageMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrokerageMember_userId_key" ON "BrokerageMember"("userId");
CREATE INDEX IF NOT EXISTS "BrokerageMember_brokerageId_idx" ON "BrokerageMember"("brokerageId");

-- AlterTable: Transaction multi-tenant columns
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "brokerageId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "assignedTcId" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_brokerageId_idx" ON "Transaction"("brokerageId");
CREATE INDEX IF NOT EXISTS "Transaction_teamId_idx" ON "Transaction"("teamId");

-- AddForeignKey
ALTER TABLE "TCSSession"
    ADD CONSTRAINT "TCSSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TCSSession"
    ADD CONSTRAINT "TCSSession_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Team"
    ADD CONSTRAINT "Team_brokerageId_fkey"
    FOREIGN KEY ("brokerageId") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BrokerageMember"
    ADD CONSTRAINT "BrokerageMember_brokerageId_fkey"
    FOREIGN KEY ("brokerageId") REFERENCES "Brokerage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BrokerageMember"
    ADD CONSTRAINT "BrokerageMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BrokerageMember"
    ADD CONSTRAINT "BrokerageMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
