import { NextRequest, NextResponse } from "next/server"
import {
  lookupFloodZone,
  lookupAssessorRecord,
  getMarketSnapshot,
  LOUISIANA_BUYER_PROGRAMS,
  calculatePITI,
  calculateNetProceeds,
  type PITIInput,
  type NetProceedsInput,
} from "@/lib/data/louisiana-live"

export const runtime = "nodejs"

// GET /api/data/louisiana?action=flood&address=...
// GET /api/data/louisiana?action=assessor&address=...
// GET /api/data/louisiana?action=market&address=...
// GET /api/data/louisiana?action=programs
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")
  const address = searchParams.get("address") || ""

  try {
    if (action === "flood") {
      if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })
      const result = await lookupFloodZone(address)
      return NextResponse.json(result)
    }

    if (action === "assessor") {
      if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })
      const result = await lookupAssessorRecord(address)
      return NextResponse.json(result)
    }

    if (action === "market") {
      const snapshot = getMarketSnapshot(address)
      return NextResponse.json(snapshot)
    }

    if (action === "programs") {
      return NextResponse.json(LOUISIANA_BUYER_PROGRAMS)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    console.error("[LA Data API]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/data/louisiana — calculator endpoints
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action")

  try {
    const body = await req.json()

    if (action === "piti") {
      const input: PITIInput = body
      const result = calculatePITI(input)
      return NextResponse.json(result)
    }

    if (action === "net-proceeds") {
      const input: NetProceedsInput = body
      const result = calculateNetProceeds(input)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err) {
    console.error("[LA Data API POST]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
