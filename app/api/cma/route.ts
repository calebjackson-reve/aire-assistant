import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { runMultiSourceCMA } from "@/lib/data/engines/multi-source-cma"

/**
 * POST /api/cma
 * Run a multi-source CMA for an address.
 * Fetches from Paragon MLS, PropStream, Zillow, and RPR in parallel.
 *
 * Body: { address: string, listPrice?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { address, listPrice } = await req.json()
    if (!address) {
      return NextResponse.json({ error: "address is required" }, { status: 400 })
    }

    const cma = await runMultiSourceCMA(address, listPrice)

    return NextResponse.json({ cma })
  } catch (err) {
    console.error("[cma] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
