import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DarkLayout } from "@/components/layouts/DarkLayout"

export default async function AireLayout({ children }: { children: React.ReactNode }) {
  let activeCount = 0
  let overdueCount = 0
  let mustOnboard = false

  try {
    const { userId } = await auth()
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
          transactions: {
            where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
            include: {
              deadlines: { where: { completedAt: null }, select: { dueDate: true } },
            },
          },
        },
      })
      if (user) {
        // Day One redirect: new users (onboarded === false) go to /onboarding.
        // Users who signed up before this column existed have onboarded=false by default,
        // but we only redirect if they also have zero transactions — that keeps existing
        // active accounts from being trapped on a setup page.
        if (user.onboarded === false && user.transactions.length === 0) {
          mustOnboard = true
        }
        activeCount = user.transactions.length
        const now = new Date()
        overdueCount = user.transactions.reduce(
          (acc, t) => acc + t.deadlines.filter(d => new Date(d.dueDate) < now).length,
          0
        )
      }
    }
  } catch {
    // Auth may fail during build — badges default to 0
  }

  if (mustOnboard) redirect("/onboarding")

  return (
    <DarkLayout activeCount={activeCount} overdueCount={overdueCount}>
      {children}
    </DarkLayout>
  )
}
