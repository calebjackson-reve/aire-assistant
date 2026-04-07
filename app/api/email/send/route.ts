import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

/**
 * POST /api/email/send — Send an email reply via Resend
 * Body: { logId, to, subject, body }
 */
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { logId, to, subject, body } = (await request.json()) as {
    logId?: string
    to: string
    subject: string
    body: string
  }

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`[Email-DEV] To: ${to} | Subject: ${subject}\n${body}`)
    return NextResponse.json({ sent: true, dev: true })
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${user.firstName ?? "AIRE"} <notifications@aireintel.org>`,
        to: [to],
        subject,
        html: body.replace(/\n/g, "<br/>"),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error("[Email-Send] Resend error:", err)
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    // Mark the communication log as handled if logId provided
    if (logId) {
      await prisma.communicationLog.update({
        where: { id: logId },
        data: { respondedAt: new Date(), status: "REPLIED" },
      }).catch(() => {}) // non-critical
    }

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error("[Email-Send] Error:", err)
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
  }
}
