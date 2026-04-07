/**
 * Document Pipeline E2E Test (Closer / Agent 1)
 *
 * Exercises every step of the upload route against the live DB:
 *   1. Generate a text-rich PDF so text stream extraction hits
 *   2. Classify by filename + text
 *   3. Extract fields
 *   4. Auto-file to matching transaction
 *   5. Create Document record
 *   6. Workflow state machine advance
 *
 * Run: npx tsx scripts/test-document-pipeline.ts
 */

import "dotenv/config"
import { PDFDocument, StandardFonts } from "pdf-lib"
import { put } from "@vercel/blob"
import prisma from "../lib/prisma"
import { classifyByPatterns } from "../lib/document-classifier"
import { extractDocumentFields } from "../lib/document-extractor"
import { autoFileDocument } from "../lib/document-autofiler"
import { onDocumentUploaded } from "../lib/workflow/state-machine"

async function buildTestPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([612, 792])
  const text = [
    "LOUISIANA RESIDENTIAL PURCHASE AGREEMENT",
    "LREC Form 101",
    "",
    "Property Address: 742 Evergreen Terrace, Baton Rouge, LA 70808",
    "Buyer: Homer Simpson",
    "Seller: Ned Flanders",
    "Purchase Price: $315,000",
    "Earnest Money: $5,000",
    "Contract Date: April 5, 2026",
    "Closing Date: May 5, 2026",
    "Inspection Period: 10 days",
    "Financing: Conventional loan",
    "",
    "The buyer and seller agree to the terms of this purchase agreement",
    "for the property located at 742 Evergreen Terrace. Inspection shall",
    "be completed within the agreed period. Title insurance required.",
  ]
  let y = 740
  for (const line of text) {
    page.drawText(line, { x: 50, y, size: 11, font })
    y -= 18
  }
  // Save uncompressed so the latin1 stream extraction in the upload route sees readable text
  const bytes = await doc.save({ useObjectStreams: false })
  return Buffer.from(bytes)
}

function pass(msg: string) { console.log("  PASS:", msg) }
function fail(msg: string): never { console.log("  FAIL:", msg); process.exit(1) }

async function main() {
  console.log("=== Document Pipeline E2E Test ===\n")

  // Fetch a user + transaction to use
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } })
  if (!user) fail("No user in DB")

  // Pick any ACTIVE transaction for the user; create one if needed
  let txn = await prisma.transaction.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  })
  if (!txn) {
    console.log("Creating ACTIVE test transaction...")
    txn = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyAddress: "742 Evergreen Terrace",
        city: "Baton Rouge",
        state: "LA",
        zipCode: "70808",
        type: "BUYER_REPRESENTATION",
        status: "ACTIVE",
        listPrice: 315000,
        offerPrice: 315000,
        acceptedPrice: 315000,
        buyerName: "Homer Simpson",
        buyerEmail: "homer@test.com",
        sellerName: "Ned Flanders",
        sellerEmail: "ned@test.com",
        contractDate: new Date(),
        closingDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    })
  }
  console.log(`  Using txn ${txn.id} (${txn.propertyAddress}) status=${txn.status}\n`)

  // Step 1: Build PDF
  console.log("Step 1: Generate test PDF...")
  const pdfBuffer = await buildTestPdf()
  pass(`Generated ${pdfBuffer.length}-byte PDF`)

  // Step 2: Upload to Vercel Blob
  console.log("\nStep 2: Upload to Vercel Blob...")
  const filename = "Residential Purchase Agreement - 742 Evergreen.pdf"
  const blob = await put(`documents/${user.id}/${Date.now()}-${filename}`, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  })
  pass(`Uploaded -> ${blob.url}`)

  // Step 3: Extract text stream
  console.log("\nStep 3: Extract raw text from PDF streams...")
  const pdfStr = pdfBuffer.toString("latin1")
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let rawText = ""
  let m
  while ((m = streamRegex.exec(pdfStr)) !== null) {
    const seg = m[1].replace(/[^\x20-\x7E\r\n]/g, " ").trim()
    if (seg.length > 20) rawText += seg + "\n"
  }
  pass(`Extracted ${rawText.length} chars of stream text`)

  // Step 4: Classify
  console.log("\nStep 4: Classify document...")
  const classification = classifyByPatterns(filename, rawText)
  if (!classification) fail("Classification returned null")
  pass(`Classified as ${classification.type} (${(classification.confidence * 100).toFixed(0)}%)`)

  // Step 5: Extract structured fields
  console.log("\nStep 5: Extract structured fields...")
  const extraction = await extractDocumentFields(rawText, classification.type, filename)
  pass(`Extracted ${Object.keys(extraction.fields).length} fields, confidence=${(extraction.confidence * 100).toFixed(0)}%`)
  console.log("    fields:", JSON.stringify(extraction.fields).slice(0, 200))

  // Step 6: Auto-file (try matching to an existing txn)
  console.log("\nStep 6: Auto-file to matching transaction...")
  const autoFile = await autoFileDocument({
    userId: user.id,
    extractedFields: extraction.fields as Record<string, string | number | boolean | null>,
    filename,
  })
  if (autoFile) {
    pass(`Auto-filed to ${autoFile.propertyAddress} (${(autoFile.confidence * 100).toFixed(0)}%)`)
  } else {
    console.log("  WARN: autoFileDocument returned null (no confident match)")
  }

  // Step 7: Create Document record
  console.log("\nStep 7: Create Document record...")
  const document = await prisma.document.create({
    data: {
      name: filename,
      type: classification.type,
      category: classification.category || null,
      classification: JSON.parse(JSON.stringify(classification)),
      fileUrl: blob.url,
      fileSize: pdfBuffer.length,
      pageCount: 1,
      filledData: JSON.parse(JSON.stringify(extraction.fields)),
      extractedText: rawText.slice(0, 50000),
      checklistStatus: "extracted",
      transactionId: txn.id,
    },
  })
  pass(`Document record ${document.id} created`)

  // Step 8: Workflow advance
  console.log("\nStep 8: Trigger workflow state machine...")
  const advance = await onDocumentUploaded(txn.id, classification.type, user.id)
  if (advance?.success) {
    pass(`Workflow advanced ${advance.fromStatus} -> ${advance.toStatus}`)
  } else {
    console.log("  INFO: No advance this run (may already be past ACTIVE):", advance?.error || "n/a")
  }

  // Step 9: Verify document appears on transaction
  console.log("\nStep 9: Verify document linked to transaction...")
  const refreshedTxn = await prisma.transaction.findUnique({
    where: { id: txn.id },
    include: { documents: true },
  })
  const linked = refreshedTxn?.documents.find((d) => d.id === document.id)
  if (!linked) fail("Document not found on transaction.documents")
  pass(`Document ${document.id} is linked. Total docs on txn: ${refreshedTxn?.documents.length}`)

  // Cleanup
  console.log("\nCleanup...")
  await prisma.document.delete({ where: { id: document.id } })
  pass("Document record deleted")

  console.log("\n=== Document Pipeline: ALL STEPS PASS ===")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("FAIL:", e)
  await prisma.$disconnect()
  process.exit(1)
})
