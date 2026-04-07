import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { IntelligenceDashboard } from "./IntelligenceDashboard"
import { ScoredPropertiesTable } from "./ScoredPropertiesTable"

export default async function IntelligencePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/intelligence")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        select: {
          id: true,
          propertyAddress: true,
          propertyCity: true,
          propertyState: true,
          propertyZip: true,
          listPrice: true,
          acceptedPrice: true,
          status: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  })

  if (!user) redirect("/sign-in")

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
          Market Intelligence
        </h1>
        <p className="text-cream-dim text-sm mt-1">
          AIRE Estimate AVM · Powered by aire-intelligence
        </p>
      </div>

      <IntelligenceDashboard transactions={user.transactions} />

      <div className="mt-10">
        <ScoredPropertiesTable />
      </div>
    </div>
  )
}
