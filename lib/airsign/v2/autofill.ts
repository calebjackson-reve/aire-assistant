import prisma from "@/lib/prisma"
import { resolveDataKey, loopDataFromTransaction, deepMergeLoopData } from "./data-keys"

/**
 * Autofill — the Loop Data Model hydration engine.
 *
 * Flow:
 *   Transaction.loopData ← authoritative blob (agent-owned, editable)
 *   AirSignEnvelope.loopDataSnapshot ← frozen copy at envelope creation/hydration
 *   AirSignField.dataKey ← binding to a Loop Data key (e.g. "loop.property.street")
 *   AirSignField.value ← pre-filled from the snapshot for TEXT/DATE/NAME/CHECKBOX types
 *
 * DRAFT envelopes are re-hydrated when loopData changes.
 * SENT / IN_PROGRESS envelopes are NEVER auto-re-hydrated (snapshot is immutable).
 * A diff helper surfaces staleness so the agent can decide whether to void+resend.
 */

export async function ensureLoopData(transactionId: string): Promise<Record<string, unknown>> {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!txn) throw new Error(`Transaction ${transactionId} not found`)
  if (txn.loopData) return txn.loopData as Record<string, unknown>

  const seeded = loopDataFromTransaction(txn)
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { loopData: JSON.parse(JSON.stringify(seeded)) },
  })
  return seeded as Record<string, unknown>
}

export async function updateLoopData(
  transactionId: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const current = await ensureLoopData(transactionId)
  const merged = deepMergeLoopData(current, patch)

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { loopData: JSON.parse(JSON.stringify(merged)) },
  })

  await rehydrateDraftEnvelopes(transactionId)
  return merged
}

export async function hydrateEnvelope(envelopeId: string): Promise<number> {
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    include: { fields: true },
  })
  if (!envelope) throw new Error(`Envelope ${envelopeId} not found`)
  if (!envelope.transactionId) return 0

  const loopData = await ensureLoopData(envelope.transactionId)

  await prisma.airSignEnvelope.update({
    where: { id: envelopeId },
    data: { loopDataSnapshot: JSON.parse(JSON.stringify(loopData)) },
  })

  let filled = 0
  for (const field of envelope.fields) {
    if (!field.dataKey) continue
    if (field.filledAt) continue
    if (field.type === "SIGNATURE" || field.type === "INITIALS" || field.type === "STRIKETHROUGH") continue

    const v = resolveDataKey(loopData, field.dataKey)
    if (v == null) continue

    const valueStr = formatForField(v, field.type)
    if (valueStr == null) continue

    await prisma.airSignField.update({
      where: { id: field.id },
      data: { value: valueStr },
    })
    filled++
  }
  return filled
}

export async function rehydrateDraftEnvelopes(transactionId: string): Promise<number> {
  const envelopes = await prisma.airSignEnvelope.findMany({
    where: { transactionId, status: "DRAFT" },
    select: { id: true },
  })
  let total = 0
  for (const e of envelopes) {
    total += await hydrateEnvelope(e.id)
  }
  return total
}

export interface LoopDataDiff {
  key: string
  snapshot: unknown
  current: unknown
}

export async function snapshotDiff(envelopeId: string): Promise<LoopDataDiff[]> {
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    select: { transactionId: true, loopDataSnapshot: true, fields: { select: { dataKey: true } } },
  })
  if (!envelope || !envelope.transactionId || !envelope.loopDataSnapshot) return []

  const current = await ensureLoopData(envelope.transactionId)
  const keys = Array.from(new Set(envelope.fields.map((f) => f.dataKey).filter((k): k is string => !!k)))

  const diffs: LoopDataDiff[] = []
  for (const k of keys) {
    const s = resolveDataKey(envelope.loopDataSnapshot, k)
    const c = resolveDataKey(current, k)
    if (!isEqual(s, c)) diffs.push({ key: k, snapshot: s, current: c })
  }
  return diffs
}

function formatForField(v: unknown, type: string): string | null {
  if (v == null) return null
  if (type === "DATE") {
    const d = typeof v === "string" ? new Date(v) : v instanceof Date ? v : null
    if (!d || isNaN(d.getTime())) return null
    return d.toLocaleDateString("en-US")
  }
  if (type === "CHECKBOX") return v ? "true" : "false"
  if (typeof v === "number") return String(v)
  return String(v)
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == b
  if (typeof a !== typeof b) return false
  if (typeof a !== "object") return false
  return JSON.stringify(a) === JSON.stringify(b)
}
