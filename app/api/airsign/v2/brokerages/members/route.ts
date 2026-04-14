import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireBrokeragePermission } from "@/lib/airsign/v2/auth"

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await prisma.user.findUnique({ where: { clerkId } })
  if (!caller) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const callerMember = await prisma.brokerageMember.findUnique({ where: { userId: caller.id } })
  if (!callerMember) return NextResponse.json({ error: "Not in a brokerage" }, { status: 404 })

  const body = await req.json()
  if (!body.email || !body.role) {
    return NextResponse.json({ error: "email and role required" }, { status: 400 })
  }

  try {
    await requireBrokeragePermission(caller.id, callerMember.brokerageId, "member.invite")
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 })
  }

  const target = await prisma.user.findUnique({ where: { email: body.email } })
  if (!target) return NextResponse.json({ error: "No AIRE user with that email — they must sign up first" }, { status: 404 })

  const existing = await prisma.brokerageMember.findUnique({ where: { userId: target.id } })
  if (existing) return NextResponse.json({ error: "User already belongs to a brokerage" }, { status: 409 })

  const member = await prisma.brokerageMember.create({
    data: {
      brokerageId: callerMember.brokerageId,
      userId: target.id,
      role: body.role,
      teamId: body.officeId ?? null,
    },
  })
  return NextResponse.json({ member })
}

export async function DELETE(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const caller = await prisma.user.findUnique({ where: { clerkId } })
  if (!caller) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const callerMember = await prisma.brokerageMember.findUnique({ where: { userId: caller.id } })
  if (!callerMember) return NextResponse.json({ error: "Not in a brokerage" }, { status: 404 })

  const url = new URL(req.url)
  const memberId = url.searchParams.get("memberId")
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 })

  try {
    await requireBrokeragePermission(caller.id, callerMember.brokerageId, "member.remove")
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 403 })
  }

  await prisma.brokerageMember.delete({ where: { id: memberId } })
  return NextResponse.json({ ok: true })
}
