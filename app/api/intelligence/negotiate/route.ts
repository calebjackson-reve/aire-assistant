// app/api/intelligence/negotiate/route.ts
//
// Negotiation Intelligence — on-demand offer analysis.
// POST: { transactionId, offerPrice, terms } → run analysis → return recommendation

import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { analyzeNegotiation } from "@/lib/agents/negotiation-intelligence"

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

  let body: {
    transactionId?: string
    offerPrice?: number
    terms?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }

  if (!body.transactionId || !body.offerPrice) {
    return NextResponse.json(
      { error: "transactionId and offerPrice are required" },
      { status: 400 }
    )
  }

  try {
    const result = await analyzeNegotiation(user.id, body.transactionId, {
      price: body.offerPrice,
      terms: body.terms || {},
    })

    // Log agent run
    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "negotiation_intelligence",
        status: "success",
        completedAt: new Date(),
        durationMs: result.processingMs,
        resultMetadata: {
          transactionId: body.transactionId,
          offerPrice: body.offerPrice,
          recommendedAction: result.recommendedAction,
        },
      },
    })

    return NextResponse.json({
      success: true,
      negotiation: result,
    })
  } catch (err) {
    console.error("[NegotiationIntel] Analysis failed:", err)

    await prisma.agentRun.create({
      data: {
        userId: user.id,
        agentName: "negotiation_intelligence",
        status: "failed",
        completedAt: new Date(),
        error: String(err),
      },
    })

    return NextResponse.json(
      { error: "Negotiation analysis failed", details: String(err) },
      { status: 500 }
    )
  }
}
