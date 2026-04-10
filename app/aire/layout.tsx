import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayoutWithBadges } from "./DarkLayoutWithBadges"

export default async function AireLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { onboarded: true, id: true },
  })

  if (!user) redirect("/sign-in")
  if (user.onboarded === false) redirect("/onboarding")

  // Lightweight count queries — integers only, no heavy joins
  const [activeCount, overdueCount] = await Promise.all([
    prisma.transaction.count({
      where: { userId: user.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
    }),
    prisma.deadline.count({
      where: {
        transaction: { userId: user.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
        completedAt: null,
        dueDate: { lt: new Date() },
      },
    }),
  ])

  return (
    <DarkLayoutWithBadges activeCount={activeCount} overdueCount={overdueCount}>
      {children}
    </DarkLayoutWithBadges>
  )
}
