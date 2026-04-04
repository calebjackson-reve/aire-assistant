/**
 * AIRE Document Memory — Self-Improving Classification Engine
 * Logs every upload, deduplicates by file hash, provides few-shot learning examples.
 */

import prisma from "@/lib/prisma";
import crypto from "crypto";

const CONFIDENCE_THRESHOLD = 0.7;

interface MemoryLogInput {
  userId: string;
  transactionId?: string;
  fileBuffer: Buffer;
  fileName: string;
  pageCount?: number;
  classifiedType: string;
  confidence: number;
  formNumber?: string;
  extractionMethod?: string;
  extractedFields?: Record<string, unknown>;
}

/**
 * Log a document upload to the memory table.
 * Deduplicates by SHA-256 hash — if the same file was uploaded before, updates the record.
 */
export async function logDocumentMemory(input: MemoryLogInput) {
  const fileHash = crypto
    .createHash("sha256")
    .update(input.fileBuffer)
    .digest("hex");

  // Check for existing record with same hash + user
  const existing = await prisma.documentMemory.findFirst({
    where: { fileHash, userId: input.userId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.documentMemory.update({
      where: { id: existing.id },
      data: {
        classifiedType: input.classifiedType,
        classifiedConf: input.confidence,
        extractionMethod: input.extractionMethod,
        extractedFields: input.extractedFields
          ? JSON.parse(JSON.stringify(input.extractedFields))
          : undefined,
      },
    });
  }

  // Determine status
  let status: "AUTO_FILED" | "NEEDS_REVIEW" | "UNKNOWN_TYPE" = "AUTO_FILED";
  if (input.classifiedType === "unknown") {
    status = "UNKNOWN_TYPE";
  } else if (input.confidence < CONFIDENCE_THRESHOLD) {
    status = "NEEDS_REVIEW";
  }

  return prisma.documentMemory.create({
    data: {
      userId: input.userId,
      transactionId: input.transactionId || null,
      fileHash,
      fileName: input.fileName,
      fileSize: input.fileBuffer.length,
      pageCount: input.pageCount || null,
      classifiedType: input.classifiedType,
      classifiedConf: input.confidence,
      formNumber: input.formNumber || null,
      extractionMethod: input.extractionMethod || null,
      extractedFields: input.extractedFields
        ? JSON.parse(JSON.stringify(input.extractedFields))
        : null,
      status,
    },
  });
}

/**
 * Retrieve few-shot learning examples from past classifications.
 * Priority: agent-corrected first (strongest signal), then confirmed high-confidence.
 */
export async function getLearningExamples(
  userId: string,
  candidateType?: string,
  limit: number = 5
): Promise<Array<{
  fileName: string;
  classifiedType: string;
  correctedType: string | null;
  finalType: string;
  confidence: number;
  formNumber: string | null;
}>> {
  // Priority 1: Corrected examples
  const corrections = await prisma.documentMemory.findMany({
    where: {
      userId,
      status: "AGENT_CORRECTED",
      ...(candidateType
        ? {
            OR: [
              { classifiedType: candidateType },
              { correctedType: candidateType },
            ],
          }
        : {}),
    },
    orderBy: { correctedAt: "desc" },
    take: Math.ceil(limit / 2),
    select: {
      fileName: true,
      classifiedType: true,
      correctedType: true,
      classifiedConf: true,
      formNumber: true,
    },
  });

  // Priority 2: Confirmed high-confidence examples
  const confirmed = await prisma.documentMemory.findMany({
    where: {
      userId,
      status: "AGENT_CONFIRMED",
      classifiedConf: { gte: 0.9 },
      ...(candidateType ? { classifiedType: candidateType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit - corrections.length,
    select: {
      fileName: true,
      classifiedType: true,
      correctedType: true,
      classifiedConf: true,
      formNumber: true,
    },
  });

  return [...corrections, ...confirmed].map((m) => ({
    fileName: m.fileName,
    classifiedType: m.classifiedType,
    correctedType: m.correctedType,
    finalType: m.correctedType || m.classifiedType,
    confidence: m.classifiedConf,
    formNumber: m.formNumber,
  }));
}
