import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { put } from "@vercel/blob"

// Saves the 5 profile fields + optional headshot upload.
// Accepts multipart form data.
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const form = await req.formData()
  const brokerageName = (form.get("brokerageName") as string | null)?.trim() || null
  const licenseNumber = (form.get("licenseNumber") as string | null)?.trim() || null
  const commissionRaw = form.get("defaultCommissionSplit") as string | null
  const preferredTitleCompany =
    (form.get("preferredTitleCompany") as string | null)?.trim() || null

  let defaultCommissionSplit: number | null = null
  if (commissionRaw && commissionRaw.trim()) {
    const parsed = parseFloat(commissionRaw)
    if (!Number.isNaN(parsed)) defaultCommissionSplit = parsed
  }

  let avatarUrl: string | undefined
  const avatar = form.get("avatar") as File | null
  if (avatar && typeof avatar === "object" && avatar.size > 0) {
    try {
      const blob = await put(
        `onboarding/avatars/${user.id}-${Date.now()}-${avatar.name}`,
        avatar,
        { access: "public" }
      )
      avatarUrl = blob.url
    } catch (err) {
      console.error("[Onboarding Profile] avatar upload failed:", err)
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      brokerageName,
      licenseNumber,
      defaultCommissionSplit,
      preferredTitleCompany,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  })

  return NextResponse.json({ ok: true, avatarUrl })
}
