import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { listVisibleTemplates } from "@/lib/airsign/v2/templates"
import { BulkSendForm } from "./BulkSendForm"

export const dynamic = "force-dynamic"

export default async function BulkSendPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in?redirect_url=/airsign/new/bulk")

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) redirect("/sign-in")

  // Only DOCUMENT / FIELD_SET templates are bulk-sendable — filter at server
  const all = await listVisibleTemplates(user.id)
  const sendable = all
    .filter((t) => t.kind === "DOCUMENT" || t.kind === "FIELD_SET")
    .map((t) => ({
      id: t.id,
      name: t.name,
      scope: t.scope,
      kind: t.kind,
      formCode: t.formCode,
      pageCount: t.pageCount,
    }))

  const recentBatches = await prisma.bulkSendBatch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      name: true,
      status: true,
      totalCount: true,
      createdCount: true,
      failedCount: true,
      createdAt: true,
    },
  })

  return (
    <DarkLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-2">AirSign · Bulk Send</p>
          <h1 className="font-[family-name:var(--font-playfair)] text-[#e8e4d8] text-4xl leading-tight">
            Send one template to many signers
          </h1>
          <p className="text-[#e8e4d8]/50 text-sm mt-2 max-w-2xl">
            Upload a CSV of signers (columns: <code className="font-[family-name:var(--font-mono)] text-[#9aab7e]">envelope_name, transaction_id, signer_name, signer_email, signer_phone, signer_role, permission, auth_method</code>). One envelope is created per row, using the selected template as the document + field layout.
          </p>
        </div>

        <BulkSendForm
          templates={sendable}
          recentBatches={recentBatches.map((b: {
            id: string
            name: string
            status: string
            totalCount: number
            createdCount: number
            failedCount: number
            createdAt: Date
          }) => ({
            ...b,
            createdAt: b.createdAt.toISOString(),
          }))}
        />
      </div>
    </DarkLayout>
  )
}
