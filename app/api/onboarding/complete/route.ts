import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Marks the user as onboarded and stamps onboardedAt.
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboarded: true,
      onboardedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
