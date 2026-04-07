import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { put } from "@vercel/blob"
import { classifyByPatterns } from "@/lib/document-classifier"
import { extractDocumentFields } from "@/lib/document-extractor"
import { multiPassExtract } from "@/lib/multi-pass-extractor"
import { autoFileDocument } from "@/lib/document-autofiler"
import { logDocumentMemory } from "@/lib/document-memory"
import { onDocumentUploaded } from "@/lib/workflow/state-machine"
import { PDFDocument } from "pdf-lib"

// Common English words — used to detect real text vs binary garbage
const REAL_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
  "new", "now", "old", "see", "way", "who", "did", "get", "let", "say",
  "she", "too", "use", "property", "buyer", "seller", "agreement", "sale",
  "purchase", "price", "date", "closing", "inspection", "address", "state",
  "parish", "louisiana", "agent", "broker", "earnest", "money", "deposit",
  "title", "loan", "mortgage", "lender", "deed", "contract", "real",
  "estate", "residential", "disclosure", "condition", "repair", "insurance",
  "appraisal", "financing", "contingency", "deadline", "notice", "shall",
  "section", "page", "this", "that", "with", "from", "have", "been",
  "will", "each", "make", "like", "just", "over", "such", "take", "year",
  "them", "some", "than", "other", "into", "more", "time", "very", "when",
  "come", "could", "after", "before", "between", "under", "within",
])

function countRealWords(text: string): number {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || []
  return words.filter((w) => REAL_WORDS.has(w)).length
}

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

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const transactionId = formData.get("transactionId") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, PNG, and JPEG files are supported" },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be under 10MB" },
        { status: 400 }
      )
    }

    // Verify transaction belongs to user if provided
    if (transactionId) {
      const txn = await prisma.transaction.findFirst({
        where: { id: transactionId, userId: user.id },
      })
      if (!txn) {
        return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
      }
    }

    // Upload to Vercel Blob
    const blob = await put(`documents/${user.id}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    })

    // Read file buffer for extraction
    const buffer = Buffer.from(await file.arrayBuffer())

    // ── Step 1: PDF analysis + AcroForm extraction ──
    let pageCount = 1
    let pdfDoc: PDFDocument | null = null
    let acroFormData: Record<string, string> = {}
    let acroFieldCount = 0
    let rawText = ""

    if (file.type === "application/pdf") {
      try {
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
        pageCount = pdfDoc.getPageCount()
      } catch (pdfError) {
        console.error("[Upload] pdf-lib failed to load PDF:", pdfError)
      }

      // Try AcroForm extraction
      if (pdfDoc) {
        try {
          const form = pdfDoc.getForm()
          const fields = form.getFields()
          acroFieldCount = fields.length

          for (const field of fields) {
            const name = field.getName()
            try {
              const textField = form.getTextField(name)
              const value = textField.getText()
              if (value && value.trim()) acroFormData[name] = value.trim()
            } catch {
              try {
                const checkbox = form.getCheckBox(name)
                acroFormData[name] = checkbox.isChecked() ? "checked" : "unchecked"
              } catch {
                try {
                  const dropdown = form.getDropdown(name)
                  const selected = dropdown.getSelected()
                  if (selected.length > 0) acroFormData[name] = selected.join(", ")
                } catch {
                  try {
                    const radio = form.getRadioGroup(name)
                    const selected = radio.getSelected()
                    if (selected) acroFormData[name] = selected
                  } catch { /* unsupported field type */ }
                }
              }
            }
          }

          const filledFields = Object.keys(acroFormData).length
          if (filledFields > 0) {
            rawText = Object.entries(acroFormData)
              .map(([key, val]) => `${key}: ${val}`)
              .join("\n")
          }
        } catch {
          // No form in this PDF
        }
      }

      // Try text stream extraction if AcroForm was sparse
      const acroFilledCount = Object.keys(acroFormData).length
      if (acroFilledCount < 5) {
        try {
          const pdfStr = buffer.toString("latin1")
          const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
          let streamText = ""
          let match
          while ((match = streamRegex.exec(pdfStr)) !== null) {
            const segment = match[1].replace(/[^\x20-\x7E\r\n]/g, " ").trim()
            if (segment.length > 20) streamText += segment + "\n"
          }
          const streamWordCount = countRealWords(streamText)
          if (streamWordCount > 30) rawText = streamText
        } catch {
          // Stream extraction failed
        }
      }
    }

    // ── Step 1b: Duplicate detection (file hash) ──
    const crypto = await import("crypto")
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex")
    const warnings: string[] = []

    const existingDoc = await prisma.document.findFirst({
      where: {
        transactionId: transactionId || undefined,
        fileUrl: { not: "" },
      },
      select: { id: true, name: true },
    })

    // Check document memory for exact file hash match
    const hashMatch = await prisma.documentMemory.findFirst({
      where: { fileHash },
      select: { id: true, fileName: true, transactionId: true },
    })
    if (hashMatch) {
      warnings.push(`Duplicate detected: this file was already uploaded as "${hashMatch.fileName}"`)
    }

    // ── Step 1c: Address mismatch detection ──
    if (transactionId && rawText) {
      const txn = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { propertyAddress: true, propertyCity: true, propertyZip: true },
      })
      if (txn) {
        const txnAddress = txn.propertyAddress.toLowerCase()
        const docText = rawText.toLowerCase()
        // Extract street number + name from transaction address
        const streetMatch = txnAddress.match(/^\d+\s+\w+/)
        const hasAddressInDoc = streetMatch
          ? docText.includes(streetMatch[0].toLowerCase())
          : docText.includes(txnAddress)

        // Check if doc mentions a DIFFERENT address
        const addressPattern = /\d{2,5}\s+[a-z]+\s+(?:st|street|ave|avenue|dr|drive|rd|road|blvd|ln|lane|ct|court|way|pl|place)\b/gi
        const docAddresses = docText.match(addressPattern) || []

        if (docAddresses.length > 0 && !hasAddressInDoc) {
          const foundAddress = docAddresses[0]
          warnings.push(`Address mismatch: this document references "${foundAddress}" but this transaction is for "${txn.propertyAddress}"`)
        }
      }
    }

    // ── Step 2: Classify with full text (not just filename) ──
    const classification = classifyByPatterns(file.name, rawText || undefined)
    let docType = classification?.type || "other"

    // Fallback: if classifier returned "other" with low confidence, try filename patterns
    if (docType === "other" && classification.confidence < 0.3) {
      const fn = file.name.toLowerCase()
      if (fn.includes("addendum")) docType = "addendum"
      else if (fn.includes("disclosure")) docType = "property_disclosure"
      else if (fn.includes("agreement") || fn.includes("contract")) docType = "purchase_agreement"
      else if (fn.includes("inspection")) docType = "inspection_report"
      else if (fn.includes("appraisal")) docType = "appraisal"
      else if (fn.includes("lead") && fn.includes("paint")) docType = "lead_paint_disclosure"
      else if (fn.includes("listing")) docType = "listing_agreement"
      else if (fn.includes("amendment")) docType = "addendum"
      else if (fn.includes("counteroffer") || fn.includes("counter offer")) docType = "counteroffer"
      else if (fn.includes("commission")) docType = "commission_agreement"
      else if (fn.includes("hud") || fn.includes("closing")) docType = "closing_document"
      else if (fn.includes("survey")) docType = "survey"
      else if (fn.includes("title")) docType = "title_document"
      else if (fn.includes("warranty")) docType = "warranty"
      if (docType !== "other") {
        classification.confidence = 0.6
        classification.type = docType
        console.log(`[Upload] Filename fallback classified "${file.name}" as ${docType}`)
      }
    }

    console.log(`[Upload] Classified "${file.name}" as ${docType} (${(classification.confidence * 100).toFixed(0)}%)`)

    // ── Step 3: Run extraction ──
    let extractionResult: {
      fields: Record<string, unknown>
      confidence: number
      warnings: string[]
      pageCount: number
    } | null = null
    let extractionMethod = "none"

    if (file.type === "application/pdf") {
      try {
        const acroFilledCount = Object.keys(acroFormData).length
        const realWordCount = countRealWords(rawText)
        const hasUsableText = realWordCount >= 30 || acroFilledCount >= 5

        if (acroFilledCount >= 5) {
          extractionMethod = "acroform"
          const result = await extractDocumentFields(rawText, docType, file.name)
          extractionResult = { fields: result.fields as Record<string, unknown>, confidence: result.confidence, warnings: result.warnings, pageCount }
        } else if (hasUsableText) {
          extractionMethod = "text"
          const result = await extractDocumentFields(rawText, docType, file.name)
          extractionResult = { fields: result.fields as Record<string, unknown>, confidence: result.confidence, warnings: result.warnings, pageCount }
        } else {
          extractionMethod = "multi-pass-vision"
          console.log(`[Upload] No usable text — launching multi-pass Vision extraction`)
          const multiResult = await multiPassExtract(buffer, docType, file.name)
          extractionResult = {
            fields: multiResult.fields,
            confidence: multiResult.confidence,
            warnings: multiResult.warnings,
            pageCount: multiResult.pageCount,
          }
        }
        console.log(`[Upload] Extraction complete via ${extractionMethod} — ${Object.keys(extractionResult?.fields || {}).length} fields`)
      } catch (extractError) {
        console.error("[Upload] Extraction failed (document still saved):", extractError)
      }
    }

    // ── Step 4: Auto-file if no transactionId provided ──
    let resolvedTransactionId = transactionId
    let autoFileResult = null

    if (!transactionId && extractionResult?.fields) {
      try {
        autoFileResult = await autoFileDocument({
          userId: user.id,
          extractedFields: extractionResult.fields as Record<string, string | number | boolean | null>,
          filename: file.name,
        })
        if (autoFileResult && autoFileResult.confidence >= 0.5) {
          resolvedTransactionId = autoFileResult.transactionId
          console.log(`[Upload] Auto-filed to "${autoFileResult.propertyAddress}" (${(autoFileResult.confidence * 100).toFixed(0)}%)`)
        }
      } catch (autoFileError) {
        console.error("[Upload] Auto-file error:", autoFileError)
      }
    }

    // ── Step 5: Create Document record with extracted data ──
    const document = await prisma.document.create({
      data: {
        name: file.name,
        type: docType,
        category: classification?.category || null,
        classification: classification ? JSON.parse(JSON.stringify(classification)) : null,
        fileUrl: blob.url,
        fileSize: file.size,
        pageCount,
        filledData: extractionResult?.fields ? JSON.parse(JSON.stringify(extractionResult.fields)) : null,
        extractedText: rawText.slice(0, 50000) || null,
        checklistStatus: extractionResult ? "extracted" : "uploaded",
        transactionId: resolvedTransactionId || undefined,
      },
    })

    // ── Step 6: Trigger workflow if attached to transaction ──
    if (resolvedTransactionId) {
      try {
        await onDocumentUploaded(resolvedTransactionId, docType, user.id)
      } catch (err) {
        console.error("[Upload] Workflow advance failed:", err)
      }
    }

    // ── Step 7: Log to document memory (non-blocking) ──
    logDocumentMemory({
      userId: user.id,
      transactionId: resolvedTransactionId || undefined,
      fileBuffer: buffer,
      fileName: file.name,
      pageCount,
      classifiedType: docType,
      confidence: classification.confidence,
      formNumber: classification.lrecFormNumber,
      extractionMethod,
      extractedFields: extractionResult?.fields as Record<string, unknown> | undefined,
    }).catch((err) => console.error("[Upload] Memory log failed:", err))

    return NextResponse.json({
      id: document.id,
      name: document.name,
      type: document.type,
      category: document.category,
      fileUrl: blob.url,
      checklistStatus: document.checklistStatus,
      warnings, // duplicate + address mismatch warnings
      classification: {
        type: classification.type,
        category: classification.category,
        confidence: classification.confidence,
        lrecFormNumber: classification.lrecFormNumber,
      },
      extraction: extractionResult ? {
        fields: extractionResult.fields,
        confidence: extractionResult.confidence,
        warnings: [...(extractionResult.warnings || []), ...warnings],
        pageCount,
        extractionMethod,
      } : null,
      autoFile: autoFileResult ? {
        transactionId: autoFileResult.transactionId,
        propertyAddress: autoFileResult.propertyAddress,
        confidence: autoFileResult.confidence,
        matchedOn: autoFileResult.matchedOn,
        applied: resolvedTransactionId === autoFileResult.transactionId,
      } : null,
    })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    )
  }
}
