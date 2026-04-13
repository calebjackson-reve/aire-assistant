import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { updateTemplate, deleteTemplate, cloneTemplate } from "@/lib/airsign/v2/templates"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const tmpl = await prisma.airSignTemplate.findUnique({ where: { id } })
  if (!tmpl) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ template: tmpl })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const { id } = await params
  const body = await req.json()
  try {
    if (body.clone) {
      const cloned = await cloneTemplate(user.id, id, {
        name: body.name,
        scope: body.scope,
        brokerageId: body.brokerageId,
        officeId: body.officeId,
      })
      return NextResponse.json({ template: cloned })
    }
    const updated = await updateTemplate(user.id, id, body)
    return NextResponse.json({ template: updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
  const { id } = await params
  try {
    await deleteTemplate(user.id, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 400 })
  }
}
