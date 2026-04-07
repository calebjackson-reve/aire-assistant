import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { EnvelopeDetail } from "./EnvelopeDetail"
import { DarkLayout } from "@/components/layouts/DarkLayout"

export default async function EnvelopeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/airsign")

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) redirect("/sign-in")

  const { id } = await params

  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id },
    include: {
      signers: true,
      fields: { orderBy: [{ page: "asc" }, { yPercent: "asc" }] },
      auditEvents: { orderBy: { createdAt: "desc" }, include: { signer: true } },
    },
  })

  if (!envelope || envelope.userId !== user.id) redirect("/airsign")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  return (
    <DarkLayout>
    <div className="max-w-5xl mx-auto px-6 py-10">
      <EnvelopeDetail
        envelope={{
          id: envelope.id,
          name: envelope.name,
          status: envelope.status,
          documentUrl: envelope.documentUrl,
          pageCount: envelope.pageCount,
          sentAt: envelope.sentAt?.toISOString() ?? null,
          completedAt: envelope.completedAt?.toISOString() ?? null,
          expiresAt: envelope.expiresAt?.toISOString() ?? null,
        }}
        signers={envelope.signers.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
          order: s.order,
          token: s.token,
          signedAt: s.signedAt?.toISOString() ?? null,
          viewedAt: s.viewedAt?.toISOString() ?? null,
          declinedAt: s.declinedAt?.toISOString() ?? null,
          signingUrl: `${appUrl}/sign/${s.token}`,
        }))}
        fields={envelope.fields.map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label,
          signerId: f.signerId,
          required: f.required,
          page: f.page,
          xPercent: f.xPercent,
          yPercent: f.yPercent,
          widthPercent: f.widthPercent,
          heightPercent: f.heightPercent,
          value: f.value,
          filledAt: f.filledAt?.toISOString() ?? null,
        }))}
        auditEvents={envelope.auditEvents.map((e) => ({
          id: e.id,
          action: e.action,
          signerName: e.signer?.name ?? null,
          ipAddress: e.ipAddress,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
    </DarkLayout>
  )
}
