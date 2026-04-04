import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

const AIRE_INTEL_API = process.env.AIRE_INTELLIGENCE_API_URL || "https://aireintel.org"

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { address, city, state, zip } = body as {
    address?: string
    city?: string
    state?: string
    zip?: string
  }

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  try {
    const res = await fetch(`${AIRE_INTEL_API}/api/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Source": "aire-assistant",
        ...(process.env.AIRE_INTELLIGENCE_API_KEY
          ? { Authorization: `Bearer ${process.env.AIRE_INTELLIGENCE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        address,
        city: city || "Baton Rouge",
        state: state || "LA",
        zip,
      }),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: "AVM service unavailable", status: res.status },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error("[Intelligence] AVM fetch failed:", err)
    return NextResponse.json(
      { error: "Failed to reach AIRE Intelligence API" },
      { status: 502 }
    )
  }
}
