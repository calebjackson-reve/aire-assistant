import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { submitForReview } from "@/lib/airsign/v2/compliance"

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  if (!body.envelopeId) return NextResponse.json({ error: "envelopeId required" }, { status: 400 })

  try {
    const review = await submitForReview(body.envelopeId, user.id)
    return NextResponse.json({ review })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}
