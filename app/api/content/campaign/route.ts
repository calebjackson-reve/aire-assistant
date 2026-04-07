/**
 * POST /api/content/campaign — Generate a multi-format content campaign for a listing
 * GET  /api/content/campaign — List campaigns for the authenticated user
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { generateContentCampaign } from "@/lib/agents/content-engine"

export async function POST(request: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const body = await request.json()
  const {
    address,
    city,
    price,
    bedrooms,
    bathrooms,
    sqft,
    yearBuilt,
    features,
    neighborhood,
    transactionId,
  } = body

  if (!address) {
    return NextResponse.json(
      { error: "address is required" },
      { status: 400 }
    )
  }

  try {
    const campaignId = await generateContentCampaign(
      user.id,
      {
        address,
        city,
        price,
        bedrooms,
        bathrooms,
        sqft,
        yearBuilt,
        features,
        neighborhood,
      },
      transactionId
    )

    const campaign = await prisma.contentCampaign.findUnique({
      where: { id: campaignId },
    })

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error("[Content Campaign] Error:", err)
    return NextResponse.json(
      { error: "Failed to generate content campaign" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const campaigns = await prisma.contentCampaign.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ campaigns })
}
