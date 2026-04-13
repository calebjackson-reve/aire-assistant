import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  createLoopImport,
  parseLoopImport,
  commitLoopImportToTransaction,
} from "@/lib/airsign/v2/loop-autofill"

/**
 * Dotloop import pipeline.
 *
 * POST (create + parse): { rawJson, transactionId? }
 *   → returns { loopImport: { id, status: "PARSED", parsedData, documentsIndex } }
 *
 * PATCH (commit to transaction): { loopImportId, transactionId }
 *   → updateLoopData + status = IMPORTED
 */
export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  if (!body.rawJson) return NextResponse.json({ error: "rawJson required" }, { status: 400 })

  const membership = await prisma.brokerageMember.findUnique({ where: { userId: user.id } })

  try {
    const row = await createLoopImport(user.id, body.rawJson, {
      transactionId: body.transactionId,
      brokerageId: membership?.brokerageId,
    })
    const parsed = await parseLoopImport(row.id)
    return NextResponse.json({ loopImport: parsed })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}

export async function PATCH(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  if (!body.loopImportId || !body.transactionId) {
    return NextResponse.json({ error: "loopImportId and transactionId required" }, { status: 400 })
  }

  const existing = await prisma.loopImport.findUnique({ where: { id: body.loopImportId } })
  if (!existing) return NextResponse.json({ error: "LoopImport not found" }, { status: 404 })
  if (existing.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const txn = await prisma.transaction.findUnique({ where: { id: body.transactionId } })
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  if (txn.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const updated = await commitLoopImportToTransaction(body.loopImportId, body.transactionId)
    return NextResponse.json({ loopImport: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const imports = await prisma.loopImport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json({ imports })
}
