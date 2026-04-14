import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"
import { normalizeRole } from "@/lib/airsign/v2/auth"
import { resolveBrokerageSettings } from "@/lib/airsign/v2/brokerage"
import { BrokerageSettingsClient } from "./BrokerageSettingsClient"

export const dynamic = "force-dynamic"

export default async function BrokeragePage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in?redirect_url=/airsign/brokerage")
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) redirect("/sign-in")

  const membership = await prisma.brokerageMember.findUnique({
    where: { userId: user.id },
    include: {
      brokerage: {
        include: {
          members: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
            orderBy: { joinedAt: "asc" },
          },
          offices: true,
        },
      },
    },
  })

  const role = membership ? normalizeRole(membership.role) : null
  const isOwner = role === "BROKER_OWNER"
  const settings = membership ? await resolveBrokerageSettings(membership.brokerageId) : null

  return (
    <DarkLayout>
      <div className="max-w-4xl mx-auto px-6 py-10">
        {membership ? (
          <>
            <div className="mb-8">
              <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-2">AirSign · Brokerage</p>
              <h1 className="font-[family-name:var(--font-playfair)] text-[#e8e4d8] text-4xl mb-1">
                {membership.brokerage.name}
              </h1>
              <p className="text-[#e8e4d8]/50 text-sm">
                <span className="font-[family-name:var(--font-mono)]">{membership.brokerage.members.length}</span> members
                {" · "}
                <span className="font-[family-name:var(--font-mono)]">{membership.brokerage.offices.length}</span> offices
              </p>
            </div>
            <BrokerageSettingsClient
              mode={isOwner ? "EDIT" : "VIEW"}
              brokerageId={membership.brokerageId}
              initial={{
                name: membership.brokerage.name,
                slug: membership.brokerage.slug,
                branding: settings?.branding ?? {},
                defaultSignerAuth: settings?.defaultSignerAuth ?? "EMAIL_LINK",
                requireSignerAuth: settings?.requireSignerAuth ?? false,
                complianceMode: settings?.complianceMode ?? "OFF",
              }}
              members={membership.brokerage.members.map((m) => ({
                id: m.id,
                userId: m.userId,
                name: `${m.user.firstName ?? ""} ${m.user.lastName ?? ""}`.trim() || m.user.email,
                email: m.user.email,
                role: m.role,
                joinedAt: m.joinedAt.toISOString(),
                isSelf: m.userId === user.id,
              }))}
              canManageMembers={isOwner || role === "OFFICE_ADMIN"}
            />
          </>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-[#9aab7e] text-xs tracking-[0.08em] uppercase mb-2">AirSign</p>
              <h1 className="font-[family-name:var(--font-playfair)] text-[#e8e4d8] text-4xl mb-2">Create your brokerage</h1>
              <p className="text-[#e8e4d8]/50 text-sm">
                Bring your office onto AIRESIGN. You&apos;ll be the first member as the broker-owner.
              </p>
            </div>
            <BrokerageSettingsClient mode="CREATE" />
          </>
        )}
      </div>
    </DarkLayout>
  )
}
