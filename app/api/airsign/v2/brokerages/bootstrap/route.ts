import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * Bootstrap a brokerage for a user who isn't yet a member.
 * First caller becomes BROKER_OWNER. Refuses if user already has a membership.
 */
export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await req.json()
  if (!body.name || !body.slug) {
    return NextResponse.json({ error: "name and slug required" }, { status: 400 })
  }

  const existing = await prisma.brokerageMember.findUnique({ where: { userId: user.id } })
  if (existing) return NextResponse.json({ error: "Already a member of a brokerage" }, { status: 409 })

  const brokerage = await prisma.brokerage.create({
    data: {
      name: body.name,
      slug: body.slug,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
    include: { members: true },
  })

  return NextResponse.json({ brokerage })
}
