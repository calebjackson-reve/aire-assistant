// lib/tcs/scoped-prisma.ts
// Day 9: Multi-tenant scoping for Transaction queries.
//
// When a user belongs to a Brokerage via BrokerageMember:
//   - OWNER / BROKER: sees every Transaction in their brokerage
//   - TC: sees every Transaction in their brokerage (scoped to teams if set)
//   - AGENT / ASSISTANT: sees only their own Transactions
//
// When a user has no BrokerageMember row, they are a single-agent user and
// can only see their own Transactions (same as AGENT role).
//
// All /api/tcs/* and /api/transactions/* routes should use `scopedTransactionWhere`
// to build their Prisma `where` clause. This ensures cross-brokerage reads are
// impossible at the query layer, not just at the response layer.

import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export type BrokerageRole = "OWNER" | "BROKER" | "TC" | "AGENT" | "ASSISTANT"

export interface ScopedContext {
  userId: string
  brokerageId: string | null
  role: BrokerageRole
  teamId: string | null
}

/**
 * Resolve the multi-tenant context for a user. Single-agent users (no
 * BrokerageMember) get role=AGENT and brokerageId=null.
 */
export async function getScopedContext(userId: string): Promise<ScopedContext> {
  const membership = await prisma.brokerageMember.findUnique({
    where: { userId },
    select: { brokerageId: true, role: true, teamId: true },
  })
  if (!membership) {
    return { userId, brokerageId: null, role: "AGENT", teamId: null }
  }
  return {
    userId,
    brokerageId: membership.brokerageId,
    role: (membership.role as BrokerageRole) ?? "AGENT",
    teamId: membership.teamId,
  }
}

/**
 * Build a Prisma `where` clause for Transaction queries scoped to the user's
 * brokerage context.
 *
 * - Solo agent (no brokerage): `{ userId }`
 * - AGENT / ASSISTANT in a brokerage: `{ userId }` (cross-agent reads off by default)
 * - TC in a brokerage: `{ brokerageId, OR: [{ teamId }, { assignedTcId: userId }] }`
 *   (falls back to all-brokerage if TC has no team set)
 * - OWNER / BROKER: `{ brokerageId }`
 */
export function scopedTransactionWhere(
  ctx: ScopedContext,
  extra?: Prisma.TransactionWhereInput,
): Prisma.TransactionWhereInput {
  const base: Prisma.TransactionWhereInput = ((): Prisma.TransactionWhereInput => {
    if (!ctx.brokerageId) return { userId: ctx.userId }
    if (ctx.role === "OWNER" || ctx.role === "BROKER") return { brokerageId: ctx.brokerageId }
    if (ctx.role === "TC") {
      if (ctx.teamId) {
        return {
          brokerageId: ctx.brokerageId,
          OR: [{ teamId: ctx.teamId }, { assignedTcId: ctx.userId }],
        }
      }
      return { brokerageId: ctx.brokerageId }
    }
    // AGENT / ASSISTANT: own rows only (even inside a brokerage)
    return { userId: ctx.userId }
  })()

  if (!extra) return base
  return { AND: [base, extra] }
}

/**
 * Verify a user can read a specific Transaction. Returns the Transaction
 * row when allowed, else null. Use this at the top of a route handler.
 */
export async function findScopedTransaction(
  userId: string,
  transactionId: string,
): Promise<{ allowed: boolean; transaction: { id: string; userId: string; brokerageId: string | null } | null }> {
  const ctx = await getScopedContext(userId)
  const where = scopedTransactionWhere(ctx, { id: transactionId })
  const transaction = await prisma.transaction.findFirst({
    where,
    select: { id: true, userId: true, brokerageId: true },
  })
  return { allowed: !!transaction, transaction }
}

/**
 * 403-style guard — returns true when access is denied. Callers can short-circuit:
 *   if (await isCrossTenantDenied(userId, txId)) return 403
 */
export async function isCrossTenantDenied(
  userId: string,
  transactionId: string,
): Promise<boolean> {
  const { allowed } = await findScopedTransaction(userId, transactionId)
  return !allowed
}
