// app/api/transactions/[id]/advance/route.ts
// Manual + auto workflow advancement endpoint.
// POST: Advance transaction to a new status.
// Validates transition, runs guards, logs WorkflowEvent.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import {
  advanceTransaction,
  getAllowedTransitions,
  type WorkflowTrigger,
} from "@/lib/workflow/state-machine"
import type { TransactionStatus } from "@prisma/client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: transactionId } = await params

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Verify ownership
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true, status: true },
  })

  if (!transaction || transaction.userId !== user.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  const body = await req.json() as {
    toStatus: TransactionStatus
    trigger?: WorkflowTrigger
    metadata?: Record<string, unknown>
  }

  if (!body.toStatus) {
    return NextResponse.json({ error: "toStatus is required" }, { status: 400 })
  }

  const result = await advanceTransaction({
    transactionId,
    toStatus: body.toStatus,
    trigger: body.trigger ?? "manual",
    triggeredBy: user.id,
    metadata: body.metadata,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, fromStatus: result.fromStatus, toStatus: result.toStatus },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    fromStatus: result.fromStatus,
    toStatus: result.toStatus,
    eventId: result.eventId,
  })
}

// GET: Return allowed transitions for current status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: transactionId } = await params

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { userId: true, status: true },
  })

  if (!transaction || transaction.userId !== user.id) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  const allowed = getAllowedTransitions(transaction.status)

  return NextResponse.json({
    currentStatus: transaction.status,
    allowedTransitions: allowed,
  })
}
