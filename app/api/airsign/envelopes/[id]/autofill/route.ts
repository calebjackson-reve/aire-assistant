// app/api/airsign/envelopes/[id]/autofill/route.ts
// POST: Detect form fields and auto-fill from transaction data.
// Returns detected fields with pre-filled values. Does NOT create AirSignField
// records — the client adds them to the FieldPlacer for review before saving.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { detectFormFields, applyAutoFillToFields } from "@/lib/airsign/form-field-detector"
import { buildAutoFillData, AGENT_PROFILE } from "@/lib/contracts/agent-profile"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { id } = await params
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id },
  })
  if (!envelope || envelope.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as {
    formType?: string
    agentSide?: "buyer" | "seller" | "dual"
  }

  // Step 1: Detect form fields from the envelope name
  const detection = detectFormFields(envelope.name, body.formType)
  if (!detection.detected) {
    return NextResponse.json({
      detected: false,
      message: "Could not detect a known LREC form from the document name. You can manually specify formType.",
      fields: [],
    })
  }

  // Step 2: If envelope has a transaction, auto-fill from transaction data
  let autoFillData: Record<string, string> = {}

  if (envelope.transactionId) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: envelope.transactionId },
    })

    if (transaction) {
      autoFillData = buildAutoFillData(AGENT_PROFILE, {
        address: transaction.propertyAddress,
        city: transaction.propertyCity,
        state: transaction.propertyState,
        zip: transaction.propertyZip ?? undefined,
        buyerName: transaction.buyerName ?? undefined,
        buyerEmail: transaction.buyerEmail ?? undefined,
        buyerPhone: transaction.buyerPhone ?? undefined,
        sellerName: transaction.sellerName ?? undefined,
        sellerEmail: transaction.sellerEmail ?? undefined,
        sellerPhone: transaction.sellerPhone ?? undefined,
        purchasePrice: transaction.acceptedPrice ?? transaction.offerPrice ?? undefined,
        mlsNumber: transaction.mlsNumber ?? undefined,
        titleCompany: transaction.titleCompany ?? undefined,
        contractDate: transaction.contractDate
          ? transaction.contractDate.toLocaleDateString("en-US")
          : undefined,
        closingDate: transaction.closingDate
          ? transaction.closingDate.toLocaleDateString("en-US")
          : undefined,
        agentSide: body.agentSide ?? "buyer",
      })
    }
  }

  // Step 3: Apply auto-fill values to detected fields
  const filledFields = applyAutoFillToFields(detection.fields, autoFillData)

  return NextResponse.json({
    detected: true,
    formType: detection.formType,
    formTitle: detection.formTitle,
    fields: filledFields,
    filledCount: filledFields.filter(f => f.value).length,
    totalCount: filledFields.length,
  })
}
