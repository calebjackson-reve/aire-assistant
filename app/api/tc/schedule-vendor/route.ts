import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import {
  scheduleVendor,
  getPreferredVendors,
  getAvailableVendorTypes,
  type VendorType,
} from "@/lib/tc/vendor-scheduler"

/**
 * GET: List preferred vendors, optionally filtered by type.
 * Query params: ?type=inspector
 */
export async function GET(req: NextRequest) {
  const { requireFeature } = await import("@/lib/auth/subscription-gate")
  const gate = await requireFeature("tc_agent")
  if (gate) return gate

  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const typeParam = req.nextUrl.searchParams.get("type") as VendorType | null

  if (typeParam) {
    const vendors = getPreferredVendors(typeParam)
    return NextResponse.json({ type: typeParam, vendors })
  }

  const types = getAvailableVendorTypes()
  const vendorsByType = Object.fromEntries(
    types.map(t => [t, getPreferredVendors(t)])
  )
  return NextResponse.json({ vendorTypes: types, vendors: vendorsByType })
}

/**
 * POST: Schedule a vendor for a transaction.
 *
 * Body:
 *   transactionId: string
 *   vendorType: VendorType
 *   preferredDate?: string
 *   preferredTime?: string
 *   notes?: string
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { transactionId, vendorType, preferredDate, preferredTime, notes } = body as {
      transactionId: string
      vendorType: VendorType
      preferredDate?: string
      preferredTime?: string
      notes?: string
    }

    if (!transactionId || !vendorType) {
      return NextResponse.json({ error: "transactionId and vendorType are required" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
      select: { propertyAddress: true },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const agentName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "AIRE Agent"

    const result = await scheduleVendor({
      transactionId,
      propertyAddress: transaction.propertyAddress,
      vendorType,
      preferredDate,
      preferredTime,
      notes,
      agentName,
    })

    return NextResponse.json({
      transactionId,
      vendorType,
      result,
      scheduledAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("TC schedule-vendor error:", error)
    return NextResponse.json({ error: "Failed to schedule vendor" }, { status: 500 })
  }
}
