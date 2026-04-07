import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import * as pdfParse from "pdf-parse"
import { extractMLSFields, toTransactionUpdate } from "@/lib/paragon/mls-autofill"
import prisma from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const documentType = (formData.get("documentType") as string) || "appraisal"
    const transactionId = formData.get("transactionId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 })
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const pdfData = await (pdfParse as any).default(buffer)
    const documentText = pdfData.text as string

    if (!documentText || documentText.trim().length < 50) {
      return NextResponse.json({ error: "Could not extract text from PDF. The document may be scanned/image-only." }, { status: 422 })
    }

    // Get agent profile for auto-fill
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, firstName: true, lastName: true, brokerageName: true },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const agentProfile = (user.firstName || user.lastName || user.brokerageName)
      ? {
          name: [user.firstName, user.lastName].filter(Boolean).join(" "),
          office: user.brokerageName || "",
        }
      : undefined

    // Run MLS field extraction
    const result = await extractMLSFields(
      documentText,
      documentType as "appraisal" | "old_listing" | "property_disclosure" | "other",
      agentProfile
    )

    // If transactionId provided, save to transaction
    let saved = false
    if (transactionId) {
      const txn = await prisma.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
      })
      if (txn) {
        const updateData = toTransactionUpdate(result)
        updateData.mlsSource = documentType === "appraisal" ? "APPRAISAL_EXTRACT" : "OLD_LISTING"
        updateData.mlsLastSyncedAt = new Date()
        await prisma.transaction.update({
          where: { id: transactionId },
          data: updateData,
        })
        saved = true
      }
    }

    return NextResponse.json({
      result: {
        filled: result.filled.map(f => ({
          fieldNumber: f.field.fieldNumber,
          name: f.field.name,
          section: f.field.section,
          value: f.value,
          confidence: f.confidence,
          source: f.source,
          transactionField: f.field.transactionField,
          options: f.field.options,
          type: f.field.type,
        })),
        missing: result.missing.map(f => ({
          fieldNumber: f.fieldNumber,
          name: f.name,
          section: f.section,
          type: f.type,
          options: f.options,
          transactionField: f.transactionField,
        })),
        totalRequired: result.totalRequired,
        totalFilled: result.totalFilled,
        completionPct: result.completionPct,
      },
      saved,
      pageCount: pdfData.numpages,
      textLength: documentText.length,
    })
  } catch (error) {
    console.error("[MLS autofill] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process document" },
      { status: 500 }
    )
  }
}
