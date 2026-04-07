// app/api/intelligence/pricing/route.ts
//
// Seller Pricing War Room — on-demand pricing analysis.
// POST: { propertyAddress, contactId? } → run analysis → return result

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runPricingAnalysis } from "@/lib/agents/pricing-war-room"

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

  let body: { propertyAddress?: string; contactId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  if (!body.propertyAddress) {
    return NextResponse.json(
      { error: "propertyAddress is required" },
      { status: 400 }
    )
  }

  try {
    const result = await runPricingAnalysis(
      user.id,
      body.propertyAddress,
      body.contactId
    )

    // Log agent run
    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "pricing_war_room",
        status: "success",
        completedAt: new Date(),
        durationMs: result.processingMs,
        resultMetadata: {
          propertyAddress: body.propertyAddress,
          recommendedPrice: result.recommendedPrice,
        },
      },
    })

    return NextResponse.json({
      success: true,
      analysis: result,
    })
  } catch (err) {
    console.error("[PricingWarRoom] Analysis failed:", err)

    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "pricing_war_room",
        status: "failed",
        completedAt: new Date(),
        error: String(err),
      },
    })

    return NextResponse.json(
      { error: "Pricing analysis failed", details: String(err) },
      { status: 500 }
    )
  }
}
