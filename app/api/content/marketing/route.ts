// app/api/content/marketing/route.ts
//
// Marketing Machine — on-demand content campaign generation.
// POST: { transactionId } → run marketing campaign → return campaign

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runMarketingCampaign } from "@/lib/agents/marketing-machine"

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
    const result = await runMarketingCampaign(user.id, body.transactionId)

    // Log agent run
    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "marketing_machine",
        status: "success",
        completedAt: new Date(),
        durationMs: result.processingMs,
        resultMetadata: {
          transactionId: body.transactionId,
          campaignId: result.campaignId,
          fairHousingPassed: result.fairHousingCheck.passed,
        },
      },
    })

    return NextResponse.json({
      success: true,
      campaign: result,
    })
  } catch (err) {
    console.error("[MarketingMachine] Campaign failed:", err)

    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "marketing_machine",
        status: "failed",
        completedAt: new Date(),
        error: String(err),
      },
    })

    return NextResponse.json(
      { error: "Marketing campaign failed", details: String(err) },
      { status: 500 }
    )
  }
}
