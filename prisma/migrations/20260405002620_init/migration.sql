-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('FREE', 'PRO', 'INVESTOR');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PENDING_INSPECTION', 'PENDING_APPRAISAL', 'PENDING_FINANCING', 'CLOSING', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentMemoryStatus" AS ENUM ('AUTO_FILED', 'NEEDS_REVIEW', 'AGENT_CONFIRMED', 'AGENT_CORRECTED', 'UNKNOWN_TYPE');

-- CreateEnum
CREATE TYPE "EnvelopeStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('SIGNATURE', 'INITIALS', 'DATE', 'TEXT', 'CHECKBOX');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "tier" "Tier" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "propertyCity" TEXT NOT NULL DEFAULT 'Baton Rouge',
    "propertyState" TEXT NOT NULL DEFAULT 'LA',
    "propertyZip" TEXT,
    "propertyType" TEXT,
    "mlsNumber" TEXT,
    "listPrice" DOUBLE PRECISION,
    "offerPrice" DOUBLE PRECISION,
    "acceptedPrice" DOUBLE PRECISION,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "sellerName" TEXT,
    "sellerEmail" TEXT,
    "sellerPhone" TEXT,
    "lenderName" TEXT,
    "titleCompany" TEXT,
    "contractDate" TIMESTAMP(3),
    "inspectionDeadline" TIMESTAMP(3),
    "appraisalDeadline" TIMESTAMP(3),
    "financingDeadline" TIMESTAMP(3),
    "closingDate" TIMESTAMP(3),
    "dotloopLoopId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "alertSent" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "templateId" TEXT,
    "filledData" JSONB,
    "extractedText" TEXT,
    "classification" JSONB,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "pageCount" INTEGER,
    "dotloopDocId" TEXT,
    "signatureStatus" TEXT,
    "checklistStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "classifiedType" TEXT NOT NULL,
    "classifiedConf" DOUBLE PRECISION NOT NULL,
    "formNumber" TEXT,
    "extractionMethod" TEXT,
    "extractedFields" JSONB,
    "status" "DocumentMemoryStatus" NOT NULL DEFAULT 'AUTO_FILED',
    "correctedType" TEXT,
    "correctedBy" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCommand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "rawTranscript" TEXT NOT NULL,
    "parsedIntent" TEXT,
    "parsedEntities" JSONB,
    "confidence" DOUBLE PRECISION,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsensusLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "agreedResult" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsensusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" TEXT NOT NULL DEFAULT 'LEAD',
    "source" TEXT,
    "notes" TEXT,
    "neighborhood" TEXT,
    "parish" TEXT,
    "currentAddress" TEXT,
    "priceRange" TEXT,
    "timeline" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "lastResponseAt" TIMESTAMP(3),
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "relationshipScore" INTEGER NOT NULL DEFAULT 50,
    "lastScoredAt" TIMESTAMP(3),
    "scoreReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipIntelLog" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "behavioralScore" INTEGER NOT NULL,
    "lifeEventScore" INTEGER NOT NULL,
    "marketTimingScore" INTEGER NOT NULL,
    "recencyScore" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "suggestedMessage" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "consensusAgreed" BOOLEAN NOT NULL DEFAULT false,
    "consensusLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationshipIntelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MorningBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "briefDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deadlineData" JSONB,
    "pipelineData" JSONB,
    "contactData" JSONB,
    "qaFlags" JSONB,
    "qaPassedAt" TIMESTAMP(3),
    "summary" TEXT,
    "actionItems" JSONB,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MorningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirSignEnvelope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "name" TEXT NOT NULL,
    "status" "EnvelopeStatus" NOT NULL DEFAULT 'DRAFT',
    "documentUrl" TEXT,
    "pageCount" INTEGER,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirSignEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirSignSigner" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SIGNER',
    "order" INTEGER NOT NULL DEFAULT 1,
    "token" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirSignSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirSignField" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signerId" TEXT,
    "type" "FieldType" NOT NULL DEFAULT 'SIGNATURE',
    "label" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "page" INTEGER NOT NULL DEFAULT 1,
    "xPercent" DOUBLE PRECISION NOT NULL,
    "yPercent" DOUBLE PRECISION NOT NULL,
    "widthPercent" DOUBLE PRECISION NOT NULL,
    "heightPercent" DOUBLE PRECISION NOT NULL,
    "value" TEXT,
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirSignField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirSignAuditEvent" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signerId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AirSignAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScan" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailScan" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scanStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanEnd" TIMESTAMP(3),
    "emailsScanned" INTEGER NOT NULL DEFAULT 0,
    "attachmentsFound" INTEGER NOT NULL DEFAULT 0,
    "documentsCreated" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'running',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "classified" BOOLEAN NOT NULL DEFAULT false,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActivity" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "phase" INTEGER,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildMetric" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "agent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "externalId" TEXT,
    "threadId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "respondedAt" TIMESTAMP(3),
    "responseLogId" TEXT,
    "draftReply" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissedCallLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "callerName" TEXT,
    "contactId" TEXT,
    "callTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissedCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "WorkflowEvent_transactionId_createdAt_idx" ON "WorkflowEvent"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "Deadline_userId_dueDate_idx" ON "Deadline"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Deadline_dueDate_alertSent_idx" ON "Deadline"("dueDate", "alertSent");

-- CreateIndex
CREATE INDEX "Document_transactionId_idx" ON "Document"("transactionId");

-- CreateIndex
CREATE INDEX "DocumentMemory_fileHash_idx" ON "DocumentMemory"("fileHash");

-- CreateIndex
CREATE INDEX "DocumentMemory_classifiedType_idx" ON "DocumentMemory"("classifiedType");

-- CreateIndex
CREATE INDEX "DocumentMemory_status_idx" ON "DocumentMemory"("status");

-- CreateIndex
CREATE INDEX "DocumentMemory_userId_createdAt_idx" ON "DocumentMemory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsensusLog_agentId_createdAt_idx" ON "ConsensusLog"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsensusLog_feature_agreed_idx" ON "ConsensusLog"("feature", "agreed");

-- CreateIndex
CREATE INDEX "Contact_agentId_relationshipScore_idx" ON "Contact"("agentId", "relationshipScore");

-- CreateIndex
CREATE INDEX "Contact_agentId_lastContactedAt_idx" ON "Contact"("agentId", "lastContactedAt");

-- CreateIndex
CREATE INDEX "Contact_agentId_type_idx" ON "Contact"("agentId", "type");

-- CreateIndex
CREATE INDEX "RelationshipIntelLog_agentId_runDate_idx" ON "RelationshipIntelLog"("agentId", "runDate");

-- CreateIndex
CREATE INDEX "RelationshipIntelLog_agentId_finalScore_idx" ON "RelationshipIntelLog"("agentId", "finalScore");

-- CreateIndex
CREATE INDEX "MorningBrief_userId_status_idx" ON "MorningBrief"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MorningBrief_userId_briefDate_key" ON "MorningBrief"("userId", "briefDate");

-- CreateIndex
CREATE INDEX "AirSignEnvelope_userId_status_idx" ON "AirSignEnvelope"("userId", "status");

-- CreateIndex
CREATE INDEX "AirSignEnvelope_transactionId_idx" ON "AirSignEnvelope"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "AirSignSigner_token_key" ON "AirSignSigner"("token");

-- CreateIndex
CREATE INDEX "AirSignSigner_envelopeId_idx" ON "AirSignSigner"("envelopeId");

-- CreateIndex
CREATE INDEX "AirSignSigner_token_idx" ON "AirSignSigner"("token");

-- CreateIndex
CREATE INDEX "AirSignField_envelopeId_page_idx" ON "AirSignField"("envelopeId", "page");

-- CreateIndex
CREATE INDEX "AirSignField_signerId_idx" ON "AirSignField"("signerId");

-- CreateIndex
CREATE INDEX "AirSignAuditEvent_envelopeId_createdAt_idx" ON "AirSignAuditEvent"("envelopeId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailAccount_userId_isActive_idx" ON "EmailAccount"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_userId_email_key" ON "EmailAccount"("userId", "email");

-- CreateIndex
CREATE INDEX "EmailScan_accountId_createdAt_idx" ON "EmailScan"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailAttachment_scanId_idx" ON "EmailAttachment"("scanId");

-- CreateIndex
CREATE INDEX "EmailAttachment_emailId_idx" ON "EmailAttachment"("emailId");

-- CreateIndex
CREATE INDEX "AgentActivity_agent_createdAt_idx" ON "AgentActivity"("agent", "createdAt");

-- CreateIndex
CREATE INDEX "AgentActivity_severity_createdAt_idx" ON "AgentActivity"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "BuildMetric_name_createdAt_idx" ON "BuildMetric"("name", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_userId_status_sentAt_idx" ON "CommunicationLog"("userId", "status", "sentAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_userId_contactId_sentAt_idx" ON "CommunicationLog"("userId", "contactId", "sentAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_threadId_idx" ON "CommunicationLog"("threadId");

-- CreateIndex
CREATE INDEX "CommunicationLog_userId_channel_direction_sentAt_idx" ON "CommunicationLog"("userId", "channel", "direction", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationLog_externalId_key" ON "CommunicationLog"("externalId");

-- CreateIndex
CREATE INDEX "MissedCallLog_userId_returned_callTime_idx" ON "MissedCallLog"("userId", "returned", "callTime");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMemory" ADD CONSTRAINT "DocumentMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentMemory" ADD CONSTRAINT "DocumentMemory_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCommand" ADD CONSTRAINT "VoiceCommand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCommand" ADD CONSTRAINT "VoiceCommand_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipIntelLog" ADD CONSTRAINT "RelationshipIntelLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipIntelLog" ADD CONSTRAINT "RelationshipIntelLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningBrief" ADD CONSTRAINT "MorningBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignEnvelope" ADD CONSTRAINT "AirSignEnvelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignSigner" ADD CONSTRAINT "AirSignSigner_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "AirSignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignField" ADD CONSTRAINT "AirSignField_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "AirSignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignField" ADD CONSTRAINT "AirSignField_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "AirSignSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignAuditEvent" ADD CONSTRAINT "AirSignAuditEvent_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "AirSignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirSignAuditEvent" ADD CONSTRAINT "AirSignAuditEvent_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "AirSignSigner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailScan" ADD CONSTRAINT "EmailScan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "EmailScan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissedCallLog" ADD CONSTRAINT "MissedCallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
