import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Saves the user's drawn/uploaded signature as base64 data URL.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = (await req.json()) as { signatureData?: string }
  if (!body.signatureData || !body.signatureData.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { signatureData: body.signatureData },
  })

  return NextResponse.json({ ok: true })
}
