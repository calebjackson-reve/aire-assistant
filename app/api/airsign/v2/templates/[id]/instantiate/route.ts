import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { instantiateTemplate } from "@/lib/airsign/v2/templates"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const { id } = await params
  const body = await req.json()

  if (!Array.isArray(body.signers) || body.signers.length === 0) {
    return NextResponse.json({ error: "signers[] required" }, { status: 400 })
  }

  try {
    const envelope = await instantiateTemplate(user.id, {
      templateId: id,
      envelopeName: body.envelopeName,
      transactionId: body.transactionId,
      signers: body.signers,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      customMessage: body.customMessage,
    })
    return NextResponse.json({ envelope })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}
