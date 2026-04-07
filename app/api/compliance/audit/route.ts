// app/api/compliance/audit/route.ts
//
// LREC Guardian — compliance audit for a single transaction.
// POST: { transactionId } → run audit → return result

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runComplianceAudit } from "@/lib/agents/lrec-guardian"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  let body: { transactionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  if (!body.transactionId) {
    return NextResponse.json(
      { error: "transactionId is required" },
      { status: 400 }
    )
  }

  try {
    const result = await runComplianceAudit(user.id, body.transactionId)

    // Log agent run
    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "lrec_guardian",
        status: "success",
        completedAt: new Date(),
        resultMetadata: {
          transactionId: body.transactionId,
          finalStatus: result.finalStatus,
          blockerCount: result.blockers.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      audit: result,
    })
  } catch (err) {
    console.error("[LRECGuardian] Audit failed:", err)

    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "lrec_guardian",
        status: "failed",
        completedAt: new Date(),
        error: String(err),
      },
    })

    return NextResponse.json(
      { error: "Compliance audit failed", details: String(err) },
      { status: 500 }
    )
  }
}
