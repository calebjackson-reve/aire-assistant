import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { IntelligenceDashboard } from "./IntelligenceDashboard"
import { ScoredPropertiesTable } from "./ScoredPropertiesTable"
import { MarketSnapshotPanel } from "./MarketSnapshotPanel"
import { MARKET_BASELINES } from "@/lib/data/louisiana-live"

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

  const markets = Object.values(MARKET_BASELINES)

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-[12px] font-medium text-[#8a9070] uppercase tracking-[0.06em] mb-2">
          AIRE Intelligence · Market Data
        </p>
        <h1 className="font-(family-name:--font-cormorant) italic text-[#1e2416] text-4xl sm:text-[42px] font-medium leading-[1.1] tracking-[-0.02em] m-0">
          Louisiana Market Intelligence
        </h1>
        <p className="text-[#8a9070] text-[15px] mt-2">
          Real-time parish market data, AIRE Estimate AVM, and pipeline intelligence
        </p>
      </div>

      {/* Parish Market Snapshots */}
      <MarketSnapshotPanel markets={markets} />

      {/* Transaction-level AVM */}
      <div style={{ marginTop: 32 }}>
        <IntelligenceDashboard transactions={user.transactions} />
      </div>

      {/* Scored Properties Admin Table */}
      <div style={{ marginTop: 32 }}>
        <ScoredPropertiesTable />
      </div>
    </div>
  )
}
