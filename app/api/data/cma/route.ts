import { NextRequest, NextResponse } from "next/server"
import { detectParish, getMarketSnapshot } from "@/lib/data/louisiana-live"

export const runtime = "nodejs"

interface CMAComp {
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  dom: number
  saleDate: string
  pricePerSqft: number
}

/**
 * POST /api/data/cma
 * Body: { address: string }
 *
 * Returns comparable sales for a subject property.
 * Uses Firecrawl when FIRECRAWL_API_KEY is set; falls back to market snapshot.
 */
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()
    if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })

    const snapshot = getMarketSnapshot(address)

    // Use Firecrawl API for live comps if key is set
    if (process.env.FIRECRAWL_API_KEY) {
      const comps = await pullCompsViaFirecrawl(address, snapshot.pricePerSqft)
      if (comps && comps.length > 0) {
        return NextResponse.json({ comps, snapshot, source: "firecrawl" })
      }
    }

    // No Firecrawl key — return market data only
    return NextResponse.json({
      comps: null,
      snapshot,
      source: "market-baseline",
      message: "Set FIRECRAWL_API_KEY in Vercel environment to enable live comp pulls from Zillow.",
    })
  } catch (err) {
    console.error("[CMA API]", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function pullCompsViaFirecrawl(
  subjectAddress: string,
  baselinePpsf: number
): Promise<CMAComp[] | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY!
  const parish = detectParish(subjectAddress)

  // Build Zillow search URL for recently sold in the area
  const zipGuess = extractZip(subjectAddress)
  const searchUrl = zipGuess
    ? `https://www.zillow.com/homes/recently-sold/${zipGuess}_rb/`
    : `https://www.zillow.com/homes/recently-sold/baton-rouge-la_rb/`

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url: searchUrl,
        formats: ["extract"],
        extract: {
          prompt: `Extract up to 8 recently sold comparable homes similar to "${subjectAddress}". For each, return: address, sale price, beds, baths, sqft, days on market, sale date.`,
          schema: {
            type: "object",
            properties: {
              comps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: { type: "string" },
                    price: { type: "number" },
                    beds: { type: "number" },
                    baths: { type: "number" },
                    sqft: { type: "number" },
                    dom: { type: "number" },
                    saleDate: { type: "string" },
                  },
                },
              },
            },
          },
        },
        timeout: 25000,
      }),
      signal: AbortSignal.timeout(30000),
    })

    const data = await res.json()
    const rawComps = data?.data?.extract?.comps
    if (!Array.isArray(rawComps)) return null

    return rawComps
      .filter((c: Partial<CMAComp>) => c.price && c.address)
      .map((c: Partial<CMAComp>) => ({
        address: c.address || "",
        price: c.price || 0,
        beds: c.beds || 0,
        baths: c.baths || 0,
        sqft: c.sqft || 0,
        dom: c.dom || 0,
        saleDate: c.saleDate || "",
        pricePerSqft: c.sqft ? Math.round((c.price || 0) / c.sqft) : baselinePpsf,
      }))
      .slice(0, 8)
  } catch (err) {
    console.error("[CMA] Firecrawl pull failed:", err)
    return null
  }
}

function extractZip(address: string): string | null {
  const match = address.match(/\b(7\d{4})\b/)
  return match ? match[1] : null
}
