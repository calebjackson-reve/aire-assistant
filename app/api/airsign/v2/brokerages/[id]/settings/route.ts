import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { resolveBrokerageSettings, upsertSettings } from "@/lib/airsign/v2/brokerage"
import { requireBrokeragePermission } from "@/lib/airsign/v2/auth"
import type { ComplianceMode, SignerAuthMethod } from "@prisma/client"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await params
  const member = await prisma.brokerageMember.findFirst({ where: { userId: user.id, brokerageId: id } })
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 })

  const settings = await resolveBrokerageSettings(id)
  return NextResponse.json({ settings })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await params
  try {
    await requireBrokeragePermission(user.id, id, "settings.edit")
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 })
  }

  const body = await req.json()
  const settings = await upsertSettings(id, {
    branding: body.branding,
    defaultSignerAuth: body.defaultSignerAuth as SignerAuthMethod | undefined,
    requireSignerAuth: body.requireSignerAuth,
    complianceMode: body.complianceMode as ComplianceMode | undefined,
    certificateTemplate: body.certificateTemplate,
  })
  return NextResponse.json({ settings })
}
