// scripts/e2e/tcs-morning-brief.spec.ts
// Day 7: Seed a transaction + TCSSession at PENDING_INSPECTION.
// Assert that researchPipeline() returns the deal with:
//   - tcs.stage === "PENDING_INSPECTION"
//   - attentionReason mentions the property address + "inspection"
//   - tcsInFlight >= 1
//
// Run: npx tsx scripts/e2e/tcs-morning-brief.spec.ts

import prisma from "../../lib/prisma"
import { researchPipeline } from "../../lib/agents/morning-brief/researchers/pipeline-researcher"

const TEST_EMAIL = "tcs-brief-e2e@aire.test"
const ADDRESS = "5834 Guice Dr"

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

async function main() {
  console.log("\n═══ TCS E2E: Morning Brief TCS integration ═══\n")

  // Setup: user with a unique clerkId (each run) to keep isolation solid
  const clerkId = `tcs-brief-e2e-${Date.now()}`
  const user = await prisma.user.create({
    data: {
      clerkId,
      email: `${TEST_EMAIL}-${Date.now()}`,
      firstName: "TCS",
      lastName: "Brief",
      onboarded: true,
    },
  })

  // Seed: a transaction at PENDING_INSPECTION
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      propertyAddress: ADDRESS,
      status: "PENDING_INSPECTION",
      buyerName: "Test Buyer",
      buyerEmail: "buyer@example.com",
      acceptedPrice: 160000,
      contractDate: new Date(),
    },
  })

  // Seed: in-flight TCSSession pointing at that transaction, in PENDING_INSPECTION
  // with some answers captured so nextQuestion() returns a real next-action prompt.
  const session = await prisma.tCSSession.create({
    data: {
      userId: user.id,
      transactionId: tx.id,
      side: "BUYER",
      currentStage: "PENDING_INSPECTION",
      answers: {
        "intake.side": "BUYER",
        "intake.address": ADDRESS,
        "intake.client": "Test Buyer / buyer@example.com",
        "intake.competing": "first",
        "intake.listPrice": "165000",
        "offer.price": "160000",
        "offer.financing": "CONVENTIONAL",
        "offer.earnestMoney": "3000",
        "offer.inspectionDays": "10",
        "offer.closingDate": new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
        "uc.titleCompany": "Bayou Title",
        "uc.disclosures": "have",
        "uc.inspector": "mine",
        "uc.lenderSent": "done",
        // note: nothing answered yet at PENDING_INSPECTION stage
      },
    },
  })

  // Call the morning-brief pipeline researcher
  const brief = await researchPipeline(clerkId)

  const deal = brief.activeDeals.find((d) => d.id === tx.id)
  assert("Deal appears in pipeline", !!deal, deal?.propertyAddress)
  assert("tcs metadata attached", !!deal?.tcs, deal?.tcs?.sessionId)
  assert(
    "TCS stage is PENDING_INSPECTION",
    deal?.tcs?.stage === "PENDING_INSPECTION",
    deal?.tcs?.stage,
  )
  assert(
    "stageLabel is human-readable (Inspection)",
    deal?.tcs?.stageLabel === "Inspection",
    deal?.tcs?.stageLabel,
  )
  assert(
    "needsAttention flagged by TCS",
    deal?.needsAttention === true,
  )
  assert(
    "attentionReason mentions property + inspection",
    !!deal?.attentionReason &&
      deal.attentionReason.toLowerCase().includes("guice") &&
      deal.attentionReason.toLowerCase().includes("inspection"),
    deal?.attentionReason ?? "",
  )
  assert("tcsInFlight aggregate ≥ 1", brief.tcsInFlight >= 1, `got ${brief.tcsInFlight}`)

  // Cleanup
  if (process.env.TCS_E2E_KEEP !== "1") {
    await prisma.tCSSession.deleteMany({ where: { userId: user.id } })
    await prisma.transaction.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS Morning Brief integration e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
