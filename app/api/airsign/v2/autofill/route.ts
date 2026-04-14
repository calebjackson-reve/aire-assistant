import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { ensureLoopData, updateLoopData, snapshotDiff } from "@/lib/airsign/v2/autofill"

/**
 * Loop Data Model editor.
 *
 * GET  ?transactionId=...            → current loopData blob (seeds from legacy fields if null)
 * POST { transactionId, patch }      → deep-merge patch + re-hydrate DRAFT envelopes
 * GET  ?envelopeId=...&diff=1        → stale-field diff (snapshot vs current)
 */
export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const url = new URL(req.url)
  const envelopeId = url.searchParams.get("envelopeId")
  if (envelopeId && url.searchParams.get("diff") === "1") {
    const envelope = await prisma.airSignEnvelope.findUnique({
      where: { id: envelopeId },
      select: { userId: true },
    })
    if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (envelope.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const diffs = await snapshotDiff(envelopeId)
    return NextResponse.json({ diffs })
  }

  const transactionId = url.searchParams.get("transactionId")
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 })
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { userId: true } })
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (txn.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const loopData = await ensureLoopData(transactionId)
  return NextResponse.json({ loopData })
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  const { transactionId, patch } = body as { transactionId: string; patch: Record<string, unknown> }
  if (!transactionId || !patch) return NextResponse.json({ error: "transactionId and patch required" }, { status: 400 })

  const txn = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { userId: true } })
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (txn.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const loopData = await updateLoopData(transactionId, patch)
  return NextResponse.json({ loopData })
}
