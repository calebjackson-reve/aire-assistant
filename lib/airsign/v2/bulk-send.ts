import prisma from "@/lib/prisma"
import type { BulkSendStatus } from "@prisma/client"
import { instantiateTemplate } from "./templates"
import { getPrimaryMembership } from "./auth"

/**
 * Bulk send — one template + a CSV of signer sets → N DRAFT envelopes.
 *
 * The batch is created eagerly in PENDING, envelopes are materialized sequentially,
 * and counts/errors update as we go. Callers trigger the normal send flow after review.
 */

export interface BulkSendRow {
  envelopeName?: string
  transactionId?: string
  customMessage?: string
  expiresAt?: string
  signers: Array<{
    name: string
    email: string
    phone?: string
    role?: string
    permission?: "CAN_SIGN" | "FILL_ONLY" | "VIEW_ONLY" | "CC"
    authMethod?: "EMAIL_LINK" | "SMS_OTP" | "ACCESS_CODE" | "KBA"
  }>
}

export interface BulkSendInput {
  templateId: string
  batchName: string
  rows: BulkSendRow[]
}

export interface BulkSendResult {
  batchId: string
  status: BulkSendStatus
  createdCount: number
  failedCount: number
  envelopeIds: string[]
  errors: Array<{ rowIndex: number; error: string; signerEmail?: string }>
}

export async function runBulkSend(userId: string, input: BulkSendInput): Promise<BulkSendResult> {
  if (!input.rows.length) throw new Error("At least one row required")

  const template = await prisma.airSignTemplate.findUnique({ where: { id: input.templateId } })
  if (!template) throw new Error("Template not found")
  if (template.kind !== "DOCUMENT" && template.kind !== "FIELD_SET") {
    throw new Error("Template must be DOCUMENT or FIELD_SET")
  }

  const membership = await getPrimaryMembership(userId)

  const batch = await prisma.bulkSendBatch.create({
    data: {
      userId,
      brokerageId: membership?.brokerageId ?? null,
      templateId: input.templateId,
      name: input.batchName,
      totalCount: input.rows.length,
      status: "PROCESSING",
    },
  })

  const envelopeIds: string[] = []
  const errors: Array<{ rowIndex: number; error: string; signerEmail?: string }> = []
  let createdCount = 0
  let failedCount = 0

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    try {
      if (!row.signers?.length) {
        throw new Error("row has no signers")
      }
      const env = await instantiateTemplate(userId, {
        templateId: input.templateId,
        envelopeName: row.envelopeName ?? template.name,
        transactionId: row.transactionId,
        signers: row.signers,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
        customMessage: row.customMessage,
        bulkSendBatchId: batch.id,
      })
      envelopeIds.push(env.id)
      createdCount++
    } catch (err) {
      failedCount++
      errors.push({
        rowIndex: i,
        error: err instanceof Error ? err.message : "Unknown error",
        signerEmail: row.signers?.[0]?.email,
      })
    }
  }

  const finalStatus: BulkSendStatus = failedCount === 0
    ? "COMPLETED"
    : createdCount === 0
      ? "FAILED"
      : "COMPLETED_WITH_ERRORS"

  await prisma.bulkSendBatch.update({
    where: { id: batch.id },
    data: {
      createdCount,
      failedCount,
      errors: errors as unknown as object,
      status: finalStatus,
      completedAt: new Date(),
    },
  })

  return {
    batchId: batch.id,
    status: finalStatus,
    createdCount,
    failedCount,
    envelopeIds,
    errors,
  }
}

/**
 * Parse a minimal CSV (no quoted-comma nesting) into BulkSendRow[].
 * Expected header: envelope_name,transaction_id,signer_name,signer_email,signer_phone,signer_role,permission,auth_method
 * Multiple signers per envelope are expressed via multiple rows with the same envelope_name (grouped).
 */
export function parseCsvRows(csv: string): BulkSendRow[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)

  const iName = idx("envelope_name")
  const iTxn = idx("transaction_id")
  const iSignerName = idx("signer_name")
  const iSignerEmail = idx("signer_email")
  const iSignerPhone = idx("signer_phone")
  const iSignerRole = idx("signer_role")
  const iPermission = idx("permission")
  const iAuth = idx("auth_method")

  if (iSignerName < 0 || iSignerEmail < 0) {
    throw new Error("CSV must include signer_name and signer_email columns")
  }

  const grouped = new Map<string, BulkSendRow>()
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim())
    const key = cells[iName] || `row-${i}`
    let row = grouped.get(key)
    if (!row) {
      row = {
        envelopeName: iName >= 0 ? cells[iName] : undefined,
        transactionId: iTxn >= 0 ? cells[iTxn] || undefined : undefined,
        signers: [],
      }
      grouped.set(key, row)
    }
    row.signers.push({
      name: cells[iSignerName],
      email: cells[iSignerEmail],
      phone: iSignerPhone >= 0 ? cells[iSignerPhone] || undefined : undefined,
      role: iSignerRole >= 0 ? cells[iSignerRole] || undefined : undefined,
      permission: iPermission >= 0 ? (cells[iPermission] as never) || undefined : undefined,
      authMethod: iAuth >= 0 ? (cells[iAuth] as never) || undefined : undefined,
    })
  }
  return Array.from(grouped.values())
}
