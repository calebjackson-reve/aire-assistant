import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { decideReview, type ReviewDecision } from "@/lib/airsign/v2/compliance"
import { requireBrokeragePermission } from "@/lib/airsign/v2/auth"

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const membership = await prisma.brokerageMember.findUnique({ where: { userId: user.id } })
  if (!membership) return NextResponse.json({ error: "Not in a brokerage" }, { status: 404 })

  const url = new URL(req.url)
  const status = url.searchParams.get("status") ?? "PENDING"

  const reviews = await prisma.complianceReview.findMany({
    where: { brokerageId: membership.brokerageId, status: status as never },
    include: {
      envelope: { select: { id: true, name: true, userId: true, transactionId: true, createdAt: true, status: true } },
      submittedBy: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { submittedAt: "asc" },
  })

  return NextResponse.json({ reviews })
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const { reviewId, decision, note, requiredChanges } = body as {
    reviewId: string
    decision: ReviewDecision
    note?: string
    requiredChanges?: string[]
  }
  if (!reviewId || !decision) return NextResponse.json({ error: "reviewId and decision required" }, { status: 400 })

  const review = await prisma.complianceReview.findUnique({ where: { id: reviewId } })
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })

  const action = decision === "APPROVE" ? "envelope.approve_review" : "envelope.reject_review"

  try {
    await requireBrokeragePermission(user.id, review.brokerageId, action)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 })
  }

  const updated = await decideReview(reviewId, user.id, decision, { note, requiredChanges })
  return NextResponse.json({ review: updated })
}
