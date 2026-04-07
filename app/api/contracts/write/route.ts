import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { writeContract } from "@/lib/contracts/contract-writer"

/**
 * POST /api/contracts/write
 * Write a contract from natural language or structured fields.
 *
 * Body:
 *   formType: "lrec-101" | "lrec-102" | "lrec-103" | "purchase_agreement" | "addendum" | "auto"
 *   naturalLanguage?: string    // NL command (parsed by Claude)
 *   fields?: Record<string, string>  // Direct field values
 *   transactionId?: string      // Link to existing transaction
 *   clauses?: string[]          // Additional clause IDs
 *   saveToTransaction?: boolean // Auto-save as Document record
 *   routeToAirSign?: boolean   // Auto-create AirSign envelope
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
    const { formType, naturalLanguage, fields, transactionId, clauses, saveToTransaction, routeToAirSign } = body

    if (!formType && !naturalLanguage) {
      return NextResponse.json({ error: "formType or naturalLanguage required" }, { status: 400 })
    }

    // If transactionId provided, pre-fill fields from transaction
    let txnFields: Record<string, string> = {}
    if (transactionId) {
      const txn = await prisma.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
      })
      if (txn) {
        txnFields = {
          property_address: txn.propertyAddress,
          property_city: txn.propertyCity,
          property_parish: "East Baton Rouge",
          buyer_name: txn.buyerName || "",
          seller_name: txn.sellerName || "",
          purchase_price: txn.acceptedPrice?.toString() || txn.listPrice?.toString() || "",
          mls_number: txn.mlsNumber || "",
          contract_date: txn.contractDate ? new Date(txn.contractDate).toLocaleDateString("en-US") : "",
          closing_date: txn.closingDate ? new Date(txn.closingDate).toLocaleDateString("en-US") : "",
          title_company: txn.titleCompany || "",
        }
      }
    }

    // Write the contract
    const result = await writeContract({
      formType: formType || "auto",
      naturalLanguage,
      fields: { ...txnFields, ...(fields || {}) },
      clauses,
      transactionId,
      userId: user.id,
    })

    // Return validation errors if critical
    if (!result.validation.valid && !naturalLanguage) {
      // For NL commands, generate anyway with warnings — agent expects a result
      // For structured input, block on errors
      return NextResponse.json({
        error: "Validation failed",
        validation: result.validation,
        fields: result.fields,
      }, { status: 422 })
    }

    // Save to transaction as a Document record
    let documentId: string | null = null
    if (saveToTransaction && transactionId && result.pdfBuffer.length > 0) {
      const doc = await prisma.document.create({
        data: {
          transactionId,
          name: result.filename,
          type: result.formType,
          category: "generated",
          filledData: JSON.parse(JSON.stringify(result.fields)),
          fileSize: result.pdfBuffer.length,
          pageCount: result.pageCount,
          checklistStatus: "draft",
        },
      })
      documentId = doc.id
    }

    // Route to AirSign
    let envelopeId: string | null = null
    if (routeToAirSign && result.pdfBuffer.length > 0) {
      // Upload PDF to blob first
      let documentUrl: string | null = null
      try {
        const { put } = await import("@vercel/blob")
        const blob = await put(
          `airsign/contracts/${user.id}/${Date.now()}-${result.filename}`,
          result.pdfBuffer,
          { access: "public", contentType: "application/pdf" }
        )
        documentUrl = blob.url
      } catch {
        // Blob not configured
      }

      if (documentUrl) {
        // Create AirSign envelope
        const signers: Array<{ name: string; email: string; role: string }> = []
        if (result.fields.buyer_name) {
          signers.push({
            name: result.fields.buyer_name,
            email: result.fields.buyer_email || "",
            role: "SIGNER",
          })
        }
        if (result.fields.seller_name) {
          signers.push({
            name: result.fields.seller_name,
            email: result.fields.seller_email || "",
            role: "SIGNER",
          })
        }

        const envelope = await prisma.airSignEnvelope.create({
          data: {
            userId: user.id,
            name: result.filename.replace(/_/g, " ").replace(".pdf", ""),
            documentUrl,
            pageCount: result.pageCount,
            transactionId: transactionId || null,
            signers: {
              create: signers.map((s, i) => ({
                name: s.name,
                email: s.email,
                role: s.role,
                order: i + 1,
              })),
            },
          },
        })
        envelopeId = envelope.id

        await prisma.airSignAuditEvent.create({
          data: {
            envelopeId: envelope.id,
            action: "created",
            metadata: JSON.parse(JSON.stringify({ source: "contract_writer", formType: result.formType })),
          },
        })
      }
    }

    // Return PDF as base64 + metadata
    return NextResponse.json({
      success: true,
      filename: result.filename,
      pageCount: result.pageCount,
      formType: result.formType,
      fields: result.fields,
      clauses: result.clauses,
      validation: result.validation,
      timing: result.timing,
      documentId,
      envelopeId,
      envelopeUrl: envelopeId ? `/airsign/${envelopeId}` : null,
      pdfBase64: result.pdfBuffer.toString("base64"),
    })
  } catch (error) {
    console.error("[Contract Writer] Error:", error)
    return NextResponse.json({ error: "Failed to write contract" }, { status: 500 })
  }
}
