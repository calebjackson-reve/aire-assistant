import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { runBulkSend, parseCsvRows, type BulkSendRow } from "@/lib/airsign/v2/bulk-send"

/**
 * Bulk send: one template → many envelopes.
 *
 * POST JSON: { templateId, batchName, rows: BulkSendRow[] }
 * POST multipart/form-data (csv upload): templateId, batchName, file=<csv>
 */
export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const contentType = req.headers.get("content-type") ?? ""

  let templateId: string
  let batchName: string
  let rows: BulkSendRow[]

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    templateId = String(form.get("templateId") ?? "")
    batchName = String(form.get("batchName") ?? "Bulk send")
    const file = form.get("file") as File | null
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 })
    const csv = await file.text()
    try {
      rows = parseCsvRows(csv)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Bad CSV" }, { status: 400 })
    }
  } else {
    const body = await req.json()
    templateId = body.templateId
    batchName = body.batchName ?? "Bulk send"
    rows = body.rows ?? []
  }

  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 })
  if (!rows.length) return NextResponse.json({ error: "no rows parsed" }, { status: 400 })

  try {
    const result = await runBulkSend(user.id, { templateId, batchName, rows })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const batches = await prisma.bulkSendBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return NextResponse.json({ batches })
}
