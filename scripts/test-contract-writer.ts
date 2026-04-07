import { writeContract } from "../lib/contracts/contract-writer"

async function main() {
  console.log("Testing contract writer...")

  const result = await writeContract({
    formType: "lrec-101",
    naturalLanguage:
      "Purchase agreement for 742 Evergreen Terrace, Baton Rouge LA 70808. Buyer Homer Simpson, Seller Ned Flanders. Price 315000. Closing May 5 2026. 10-day inspection. Conventional financing.",
    fields: {},
    userId: "test",
  })

  console.log("PASS: Contract generated")
  console.log("  Filename:", result.filename)
  console.log("  Pages:", result.pageCount)
  console.log("  Form Type:", result.formType)
  console.log("  Fields count:", Object.keys(result.fields).length)
  console.log("  Buyer:", result.fields.buyer_name || "NOT FOUND")
  console.log("  Seller:", result.fields.seller_name || "NOT FOUND")
  console.log("  Price:", result.fields.purchase_price || "NOT FOUND")
  console.log("  Address:", result.fields.property_address || "NOT FOUND")
  console.log("  Validation:", result.validation.valid ? "VALID" : "ERRORS")
  if (!result.validation.valid) console.log("  Errors:", result.validation.errors.join("; "))
  if (result.validation.warnings.length > 0) console.log("  Warnings:", result.validation.warnings.join("; "))
  console.log("  PDF size:", result.pdfBuffer.length, "bytes")
  console.log("  Timing:", JSON.stringify(result.timing))
}

main().catch((e) => {
  console.error("FAIL:", e)
  process.exit(1)
})
