import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import {
  sendPartyUpdate,
  notifyAllParties,
  type TemplateType,
  type PartyInfo,
  type TemplateContext,
} from "@/lib/tc/party-communications"

/**
 * POST: Send a templated transaction update to one or all parties.
 *
 * Body:
 *   transactionId: string
 *   templateType: TemplateType
 *   targetRole?: "buyer" | "seller" | "lender" | "title" | "all" (default "all")
 *   notes?: string
 *   date?: string
 *   documentName?: string
 *   deadlineName?: string
 */
export async function POST(req: NextRequest) {
  try {
    const { requireFeature } = await import("@/lib/auth/subscription-gate")
    const gate = await requireFeature("tc_agent")
    if (gate) return gate

    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { transactionId, templateType, targetRole = "all", notes, date, documentName, deadlineName } = body as {
      transactionId: string
      templateType: TemplateType
      targetRole?: string
      notes?: string
      date?: string
      documentName?: string
      deadlineName?: string
    }

    if (!transactionId || !templateType) {
      return NextResponse.json({ error: "transactionId and templateType are required" }, { status: 400 })
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: user.id },
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const ctx: TemplateContext = {
      propertyAddress: transaction.propertyAddress,
      agentName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Your AIRE agent",
      buyerName: transaction.buyerName,
      sellerName: transaction.sellerName,
      price: transaction.acceptedPrice || transaction.listPrice,
      date: date || (transaction.closingDate ? new Date(transaction.closingDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : null),
      deadlineName,
      documentName,
      status: transaction.status.replace(/_/g, " ").toLowerCase(),
      notes,
    }

    // Build party list from transaction
    const allParties: PartyInfo[] = []
    if (transaction.buyerName) {
      allParties.push({ name: transaction.buyerName, email: transaction.buyerEmail, phone: transaction.buyerPhone, role: "buyer" })
    }
    if (transaction.sellerName) {
      allParties.push({ name: transaction.sellerName, email: transaction.sellerEmail, phone: transaction.sellerPhone, role: "seller" })
    }

    if (allParties.length === 0) {
      return NextResponse.json({ error: "No parties with contact info on this transaction" }, { status: 400 })
    }

    let results
    if (targetRole === "all") {
      results = await notifyAllParties(templateType, ctx, allParties)
    } else {
      const party = allParties.find(p => p.role === targetRole)
      if (!party) {
        return NextResponse.json({ error: `No ${targetRole} found on this transaction` }, { status: 400 })
      }
      const r = await sendPartyUpdate(templateType, ctx, party)
      results = [r]
    }

    return NextResponse.json({
      transactionId,
      templateType,
      results,
      sentAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("TC send-update error:", error)
    return NextResponse.json({ error: "Failed to send update" }, { status: 500 })
  }
}
