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
    <div style={{ maxWidth: 1024, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "#8a9070", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          AIRE Intelligence · Market Data
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 700, color: "#1e2416", margin: 0 }}>
          Louisiana Market Intelligence
        </h1>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: "#8a9070", marginTop: 8 }}>
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
