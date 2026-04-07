import { writeContract } from "../lib/contracts/contract-writer"
import prisma from "../lib/prisma"
import { put } from "@vercel/blob"

async function main() {
  console.log("Testing contract -> AirSign flow...\n")

  const user = await prisma.user.findFirst({
    where: { clerkId: "user_3BPsxwC2Ahn17KlWwzHwsYaWLJY" },
  })
  if (!user) {
    console.log("FAIL: No user found")
    process.exit(1)
  }

  const txn = await prisma.transaction.findFirst({
    where: { userId: user.id, propertyAddress: "742 Evergreen Terrace" },
  })
  if (!txn) {
    console.log("FAIL: No test transaction found")
    process.exit(1)
  }

  // Step 1: Generate contract
  console.log("Step 1: Generating contract...")
  const result = await writeContract({
    formType: "lrec-101",
    naturalLanguage:
      "Purchase agreement for 742 Evergreen Terrace, Baton Rouge LA 70808. Buyer Homer Simpson (homer@test.com), Seller Ned Flanders (ned@test.com). Price 315000. Earnest money 5000. Contract date April 5 2026. Closing May 5 2026. 10-day inspection. Conventional financing.",
    fields: {},
    transactionId: txn.id,
    userId: user.id,
  })
  console.log("  PASS: Contract generated -", result.filename, "(" + result.pdfBuffer.length + " bytes)")

  // Step 2: Upload PDF to Vercel Blob
  console.log("\nStep 2: Uploading PDF to Vercel Blob...")
  let documentUrl: string | null = null
  try {
    const blob = await put(
      `airsign/contracts/${user.id}/${Date.now()}-${result.filename}`,
      result.pdfBuffer,
      { access: "public", contentType: "application/pdf" }
    )
    documentUrl = blob.url
    console.log("  PASS: Uploaded to Blob -", documentUrl)
  } catch (e: any) {
    console.log("  FAIL: Blob upload failed -", e.message)
    process.exit(1)
  }

  // Step 3: Create AirSign envelope
  console.log("\nStep 3: Creating AirSign envelope...")
  const signers: Array<{ name: string; email: string; role: string }> = []
  if (result.fields.buyer_name) {
    signers.push({
      name: result.fields.buyer_name,
      email: result.fields.buyer_email || "homer@test.com",
      role: "SIGNER",
    })
  }
  if (result.fields.seller_name) {
    signers.push({
      name: result.fields.seller_name,
      email: result.fields.seller_email || "ned@test.com",
      role: "SIGNER",
    })
  }

  const envelope = await prisma.airSignEnvelope.create({
    data: {
      userId: user.id,
      name: result.filename.replace(/_/g, " ").replace(".pdf", ""),
      documentUrl,
      pageCount: result.pageCount,
      transactionId: txn.id,
      signers: {
        create: signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          role: s.role,
          order: i + 1,
        })),
      },
    },
    include: { signers: true },
  })

  console.log("  PASS: Envelope created -", envelope.id)
  console.log("  Name:", envelope.name)
  console.log("  Signers:", envelope.signers.length)
  envelope.signers.forEach((s) => console.log("    -", s.name, "(" + s.email + ")"))
  console.log("  Transaction linked:", envelope.transactionId)
  console.log("  Document URL:", envelope.documentUrl)

  // Step 4: Create audit event
  console.log("\nStep 4: Creating audit event...")
  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: envelope.id,
      action: "created",
      metadata: JSON.parse(JSON.stringify({ source: "contract_writer", formType: "lrec-101" })),
    },
  })
  console.log("  PASS: Audit event logged")

  console.log("\n=== Contract -> AirSign Flow: ALL STEPS PASS ===")
  console.log("Envelope URL (local): /airsign/" + envelope.id)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("FAIL:", e)
  process.exit(1)
})
