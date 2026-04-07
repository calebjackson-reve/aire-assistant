/**
 * AIRE Voice → Addendum E2E test
 *
 * Simulates a voice command for creating an addendum:
 *   1. Runs the voice pipeline (classification + English preview)
 *   2. Verifies requiresConfirmation + englishPreview are set
 *   3. Executes the action (writeContract → PDF → Document row)
 *   4. Verifies the Document record and PDF size
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   npx tsx scripts/test-voice-addendum.ts
 */

import prisma from "../lib/prisma"
import { runVoicePipeline } from "../lib/voice-pipeline"
import { executeAction } from "../lib/voice-action-executor"

let passed = 0
let failed = 0
function assert(cond: boolean, desc: string, extra?: unknown) {
  if (cond) {
    passed++
    console.log(`  ok   ${desc}`)
  } else {
    failed++
    console.log(`  FAIL ${desc}`)
    if (extra !== undefined) console.log("       ", extra)
  }
}

async function main() {
  console.log("\nVoice → Addendum E2E")
  console.log("=".repeat(60))

  // ── 1. Get or create a test user + transaction ──
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: "test_clerk_voice_addendum",
        email: "voicetest@aire.local",
        firstName: "Voice",
        lastName: "Tester",
      },
    })
    console.log(`  + Created test user ${user.id}`)
  } else {
    console.log(`  • Using existing user ${user.id}`)
  }

  // Use or create a test transaction
  const testAddress = "742 Evergreen Terrace"
  let txn = await prisma.transaction.findFirst({
    where: { userId: user.id, propertyAddress: testAddress },
  })
  if (!txn) {
    txn = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyAddress: testAddress,
        propertyCity: "Baton Rouge",
        propertyState: "LA",
        propertyZip: "70810",
        propertyType: "residential",
        status: "ACTIVE",
        listPrice: 315000,
        acceptedPrice: 310000,
        buyerName: "Homer Simpson",
        sellerName: "Ned Flanders",
      },
    })
    console.log(`  + Created test transaction ${txn.id}`)
  } else {
    console.log(`  • Using existing transaction ${txn.id}`)
  }

  // ── 2. Run the voice pipeline ──
  console.log("\n[1] Running voice pipeline")
  // Use a transcript the fast-path parses cleanly (no trailing clause),
  // then inject the description at execute-time (mirrors how the UI
  // lets the user edit before confirming).
  const transcript = `Create an addendum for ${testAddress}`
  console.log(`    transcript: "${transcript}"`)

  const pipelineResult = await runVoicePipeline({
    userId: user.id,
    transcript,
  })

  console.log(`    → intent: ${pipelineResult.intent}`)
  console.log(`    → entities:`, pipelineResult.entities)
  console.log(`    → englishPreview: ${pipelineResult.englishPreview}`)
  console.log(`    → requiresConfirmation: ${pipelineResult.requiresConfirmation}`)
  console.log(`    → timing: ${pipelineResult.timing.totalMs}ms`)

  assert(pipelineResult.intent === "create_addendum", "intent is create_addendum")
  assert(pipelineResult.requiresConfirmation === true, "requiresConfirmation === true")
  assert(pipelineResult.englishPreview !== null, "englishPreview is non-null")
  assert(
    (pipelineResult.englishPreview || "").toLowerCase().includes(testAddress.toLowerCase()),
    "preview mentions the address",
    pipelineResult.englishPreview
  )
  assert(pipelineResult.entities.address?.toLowerCase().includes("evergreen") ?? false, "entities.address captured")

  // ── 3. Execute the addendum action ──
  console.log("\n[2] Executing createAddendum handler")
  const execResult = await executeAction({
    userId: user.id,
    voiceCommandId: pipelineResult.voiceCommandId,
    intent: "create_addendum",
    entities: {
      ...pipelineResult.entities,
      // Ensure description is present for the clause context
      description: pipelineResult.entities.description || "extend inspection by 5 days",
    },
    confidence: pipelineResult.confidence,
  })

  console.log(`    → success: ${execResult.success}`)
  console.log(`    → message: ${execResult.message}`)
  console.log(`    → data:`, execResult.data)

  assert(execResult.success === true, "execution succeeded", execResult.message)
  assert(execResult.action === "create_addendum", "action === create_addendum")

  const docId = (execResult.data?.documentId as string) || null
  assert(!!docId, "Document ID returned")

  // ── 4. Verify Document row ──
  if (docId) {
    console.log("\n[3] Verifying Document record in DB")
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    assert(!!doc, "Document row exists")
    if (doc) {
      console.log(`    → name: ${doc.name}`)
      console.log(`    → type: ${doc.type}`)
      console.log(`    → pageCount: ${doc.pageCount}`)
      console.log(`    → fileSize: ${doc.fileSize}`)
      assert(doc.type === "addendum", "document type === 'addendum'")
      assert(doc.transactionId === txn.id, "document linked to correct transaction")
      assert((doc.fileSize ?? 0) > 0, "PDF has non-zero size")
      assert((doc.pageCount ?? 0) > 0, "PDF has at least one page")
    }
  }

  // ── 5. Verify VoiceCommand was linked ──
  console.log("\n[4] Verifying VoiceCommand linked to transaction")
  const vc = await prisma.voiceCommand.findUnique({ where: { id: pipelineResult.voiceCommandId } })
  assert(vc?.transactionId === txn.id, "voice command linked to transaction")

  // ── Summary ──
  console.log("\n" + "=".repeat(60))
  console.log(`Results: ${passed}/${passed + failed} passed`)
  if (failed > 0) {
    console.log(`FAIL: ${failed} tests failed`)
    process.exit(1)
  }
  console.log("ALL TESTS PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("Test runner error:", err)
  process.exit(1)
})
