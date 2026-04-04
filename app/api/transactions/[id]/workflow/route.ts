// app/api/transactions/[id]/workflow/route.ts
// GET: Return workflow event history for a transaction.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { getWorkflowHistory } from "@/lib/workflow/state-machine"

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

  const events = await getWorkflowHistory(transactionId)

  return NextResponse.json({
    currentStatus: transaction.status,
    events,
    totalEvents: events.length,
  })
}
