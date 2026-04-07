import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Stub: saves MLS credentials into User.onboardingData JSON.
// Real RETS/RESO integration is a future mission.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = (await req.json()) as {
    provider?: string
    username?: string
    password?: string
    agentId?: string
  }

  if (!body.provider) {
    return NextResponse.json({ error: "Provider required" }, { status: 400 })
  }

  const existing = (user.onboardingData as Record<string, unknown> | null) || {}
  const next = {
    ...existing,
    mls: {
      provider: body.provider,
      username: body.username || null,
      // Note: plaintext stored in stub — real implementation should encrypt
      password: body.password || null,
      agentId: body.agentId || null,
      connectedAt: new Date().toISOString(),
      importScheduled: true,
    },
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingData: JSON.parse(JSON.stringify(next)) },
  })

  return NextResponse.json({ ok: true, status: "Connected — import scheduled" })
}
