import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { buildCertificate } from "@/lib/airsign/v2/certificate"
import { normalizeRole } from "@/lib/airsign/v2/auth"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await params
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id },
    select: { userId: true, brokerageId: true },
  })
  if (!envelope) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let authorized = envelope.userId === user.id
  if (!authorized && envelope.brokerageId) {
    const member = await prisma.brokerageMember.findUnique({ where: { userId: user.id } })
    if (member && member.brokerageId === envelope.brokerageId) {
      const role = normalizeRole(member.role)
      if (role === "BROKER_OWNER" || role === "COMPLIANCE_OFFICER") authorized = true
    }
  }
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const pdfBytes = await buildCertificate(id)
  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${id}.pdf"`,
    },
  })
}
