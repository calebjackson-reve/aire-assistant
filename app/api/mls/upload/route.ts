import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { uploadToParagon, buildUploadPayload, isParagonConfigured } from "@/lib/paragon/mls-upload"
import { extractMLSFields } from "@/lib/paragon/mls-autofill"

/**
 * POST /api/mls/upload
 * Auto-upload a listing to Paragon MLS.
 *
 * Body: {
 *   transactionId: string,
 *   description: string,
 *   listPrice: number,
 *   photos?: { url: string, caption?: string, order: number }[],
 *   status?: "ACTIVE" | "COMING_SOON"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isParagonConfigured()) {
      return NextResponse.json({
        error: "Paragon MLS credentials not configured. Set PARAGON_RETS_URL, PARAGON_RETS_USERNAME, and PARAGON_RETS_PASSWORD.",
        configured: false,
      }, { status: 400 })
    }

    const { transactionId, description, listPrice, photos, status } = await req.json()

    if (!transactionId || !description || !listPrice) {
      return NextResponse.json(
        { error: "transactionId, description, and listPrice are required" },
        { status: 400 }
      )
    }

    // Get transaction with documents
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { documents: { orderBy: { createdAt: "desc" } } },
    })

    if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    // Extract MLS fields from best available document
    const appraisalDoc = txn.documents.find((d) => d.type?.toLowerCase().includes("appraisal"))
    const listingDoc = txn.documents.find((d) => d.type?.toLowerCase().includes("listing"))
    const bestDoc = appraisalDoc || listingDoc

    let mlsResult
    if (bestDoc?.filledData) {
      const text = typeof bestDoc.filledData === "string"
        ? bestDoc.filledData
        : JSON.stringify(bestDoc.filledData)
      const docType = (["appraisal", "old_listing", "property_disclosure"].includes(bestDoc.type || "") ? bestDoc.type : "other") as "appraisal" | "old_listing" | "property_disclosure" | "other"
      mlsResult = await extractMLSFields(text, docType)
    } else {
      // Build from transaction data
      mlsResult = {
        filled: [
          { field: { fieldNumber: 0, name: "Address", section: "location" as const, type: "text" as const, required: true }, value: txn.propertyAddress, confidence: "high" as const, source: "transaction" },
          { field: { fieldNumber: 0, name: "ListPrice", section: "property_details" as const, type: "number" as const, required: true }, value: String(listPrice), confidence: "high" as const, source: "transaction" },
        ],
        missing: [],
        totalFilled: 2,
        totalRequired: 45,
        completionPct: Math.round((2 / 45) * 100),
      }
    }

    const payload = buildUploadPayload(
      transactionId,
      mlsResult,
      description,
      listPrice,
      photos
    )
    if (status) payload.status = status

    const result = await uploadToParagon(payload)

    // If successful, update transaction with MLS number
    if (result.success && result.mlsNumber) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { mlsNumber: result.mlsNumber },
      })
    }

    return NextResponse.json({ result })
  } catch (err) {
    console.error("[mls/upload] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
