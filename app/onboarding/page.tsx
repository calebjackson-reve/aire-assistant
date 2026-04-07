import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import OnboardingClient from "./OnboardingClient"

export const dynamic = "force-dynamic"

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      emailAccounts: { where: { isActive: true }, select: { email: true } },
    },
  })
  if (!user) redirect("/sign-in")

  // Already onboarded? Go to the app.
  if (user.onboarded) redirect("/aire")

  const contactCount = await prisma.contact.count({ where: { agentId: user.id } })

  return (
    <OnboardingClient
      initial={{
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        brokerageName: user.brokerageName,
        licenseNumber: user.licenseNumber,
        defaultCommissionSplit: user.defaultCommissionSplit
          ? Number(user.defaultCommissionSplit)
          : null,
        preferredTitleCompany: user.preferredTitleCompany,
        avatarUrl: user.avatarUrl,
        hasSignature: Boolean(user.signatureData),
        gmailConnected: user.emailAccounts[0]?.email || null,
        mlsConnected: Boolean((user.onboardingData as { mls?: unknown } | null)?.mls),
        contactCount,
      }}
    />
  )
}
