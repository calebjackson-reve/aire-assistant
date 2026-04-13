// scripts/e2e/tcs-offer-to-uc.spec.ts
// End-to-end: simulate a Baton Rouge FHA buyer walking through the TCS
// conversational flow from Intake through Offer → UNDER_CONTRACT, then assert:
//   - PA Document persisted (type purchase_agreement, has fileUrl or fileSize)
//   - AirSign envelope created in DRAFT status linked to the Transaction
//   - ≥ 7 Deadline rows scheduled on the Transaction
//
// Run: npx tsx scripts/e2e/tcs-offer-to-uc.spec.ts
// Cleans up after itself unless TCS_E2E_KEEP=1 is set.

import prisma from "../../lib/prisma"
import { createSession, submitAnswer } from "../../lib/tcs/conversation-engine"

const TEST_EMAIL = "tcs-e2e@aire.test"
const TEST_ADDRESS = "9140 Jefferson Hwy"

type Answer = { key: string; value: string }

// The full Intake → Offer script a first-time buyer's agent would walk through
const SCRIPT: Answer[] = [
  // Intake
  { key: "intake.side", value: "BUYER" },
  { key: "intake.address", value: TEST_ADDRESS },
  { key: "intake.client", value: "Jane Test / jane.test@example.com" },
  { key: "intake.competing", value: "first" },
  { key: "intake.listPrice", value: "295000" },
  // Offer (entry into ACTIVE creates the Transaction row; these answers fill the PA)
  { key: "offer.price", value: "289500" },
  { key: "offer.financing", value: "FHA" },
  { key: "offer.earnestMoney", value: "3000" },
  { key: "offer.inspectionDays", value: "10" },
  { key: "offer.closingDate", value: futureDateISO(45) },
]

function futureDateISO(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

interface Assertion {
  label: string
  ok: boolean
  detail?: string
}

const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  const prefix = ok ? "  PASS" : "  FAIL"
  console.log(`${prefix}  ${label}${detail ? ` — ${detail}` : ""}`)
}

async function main() {
  console.log("\n═══ TCS E2E: Offer → Under Contract ═══\n")

  // ── Setup test user ──────────────────────────────────────────────────────
  let user = await prisma.user.findFirst({ where: { email: TEST_EMAIL } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: `tcs-e2e-${Date.now()}`,
        email: TEST_EMAIL,
        firstName: "TCS",
        lastName: "E2E",
        onboarded: true,
      },
    })
    console.log(`  Setup  created test user ${user.id}`)
  } else {
    console.log(`  Setup  reusing test user ${user.id}`)
  }

  // ── Step 1: Start session ────────────────────────────────────────────────
  console.log("\nStep 1: Starting TCS session…")
  const session = await createSession(user.id, "BUYER")
  assert(
    "Session created",
    !!session.sessionId,
    `id=${session.sessionId}`,
  )
  assert(
    "First question is intake.side",
    session.firstQuestion?.key === "intake.side",
    `got ${session.firstQuestion?.key}`,
  )

  // ── Step 2: Walk the script ──────────────────────────────────────────────
  console.log("\nStep 2: Walking the conversation script…")
  let turn
  let transactionId: string | null = null
  let totalActions = 0

  for (const step of SCRIPT) {
    turn = await submitAnswer({
      sessionId: session.sessionId,
      userId: user.id,
      questionKey: step.key,
      answer: step.value,
    })
    totalActions += turn.actions.length
    if (turn.session.transactionId && !transactionId) {
      transactionId = turn.session.transactionId
    }
    if (process.env.TCS_E2E_VERBOSE === "1") {
      console.log(
        `  ${step.key.padEnd(24)} stage=${turn.session.currentStage.padEnd(16)} advanced=${turn.stageAdvanced} actions=${turn.actions.length}`,
      )
    }
  }

  assert("Transaction row created", !!transactionId, `id=${transactionId}`)
  assert(
    "Final stage is UNDER_CONTRACT",
    turn?.session.currentStage === "UNDER_CONTRACT",
    `got ${turn?.session.currentStage}`,
  )
  assert(
    "At least one silent action logged per stage",
    totalActions >= SCRIPT.length,
    `total=${totalActions}`,
  )

  if (!transactionId) {
    console.log("\nCannot assert downstream — no Transaction created. Bailing.")
    process.exit(1)
  }

  // ── Step 3: Assert PA Document persisted ────────────────────────────────
  console.log("\nStep 3: Checking for drafted Purchase Agreement…")
  const doc = await prisma.document.findFirst({
    where: { transactionId, type: "purchase_agreement" },
    orderBy: { createdAt: "desc" },
  })
  assert("PA Document row exists", !!doc, doc ? `id=${doc.id}` : "none found")
  assert(
    "PA Document has fileUrl",
    !!doc?.fileUrl,
    doc?.fileUrl ?? "(empty)",
  )
  assert(
    "PA Document has fileSize > 0",
    (doc?.fileSize ?? 0) > 0,
    `${doc?.fileSize ?? 0} bytes`,
  )
  assert(
    "PA Document templateId = lrec-101",
    doc?.templateId === "lrec-101",
    doc?.templateId ?? "none",
  )

  // ── Step 4: Assert AirSign envelope in DRAFT ─────────────────────────────
  console.log("\nStep 4: Checking for AirSign envelope in DRAFT…")
  const envelope = await prisma.airSignEnvelope.findFirst({
    where: { transactionId, status: "DRAFT" },
    include: { signers: true },
    orderBy: { createdAt: "desc" },
  })
  assert(
    "AirSign envelope exists in DRAFT",
    !!envelope,
    envelope ? `id=${envelope.id}` : "none",
  )
  assert(
    "Envelope has PA documentUrl",
    !!envelope?.documentUrl,
    envelope?.documentUrl?.slice(0, 80) ?? "(empty)",
  )

  // ── Step 5: Assert deadlines ─────────────────────────────────────────────
  console.log("\nStep 5: Checking deadlines…")
  const deadlines = await prisma.deadline.findMany({
    where: { transactionId },
    orderBy: { dueDate: "asc" },
  })
  assert(
    "At least 7 deadlines scheduled",
    deadlines.length >= 7,
    `got ${deadlines.length}`,
  )
  const names = deadlines.map((d) => d.name.toLowerCase())
  for (const expected of [
    "earnest",
    "inspection",
    "appraisal",
    "financing",
    "closing",
  ]) {
    assert(
      `Contains "${expected}" deadline`,
      names.some((n) => n.includes(expected)),
      names.filter((n) => n.includes(expected)).join(", "),
    )
  }

  // ── Summary + cleanup ────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n───────────────────────────`)
  console.log(`${passed}/${results.length} assertions passed`)

  if (process.env.TCS_E2E_KEEP !== "1") {
    console.log("\n  Cleanup  removing test transaction + session + user…")
    await prisma.deadline.deleteMany({ where: { transactionId } })
    await prisma.airSignField.deleteMany({
      where: { envelope: { transactionId } },
    })
    await prisma.airSignAuditEvent.deleteMany({
      where: { envelope: { transactionId } },
    })
    await prisma.airSignSigner.deleteMany({
      where: { envelope: { transactionId } },
    })
    await prisma.airSignEnvelope.deleteMany({ where: { transactionId } })
    await prisma.document.deleteMany({ where: { transactionId } })
    await prisma.workflowEvent.deleteMany({ where: { transactionId } })
    await prisma.tCSSession.deleteMany({ where: { userId: user.id } })
    await prisma.transaction.delete({ where: { id: transactionId } })
    // keep user for future runs
  } else {
    console.log("\n  TCS_E2E_KEEP=1 — leaving rows for inspection.")
    console.log(`  transactionId: ${transactionId}`)
    console.log(`  sessionId:     ${session.sessionId}`)
  }

  if (failed.length > 0) {
    console.log(`\n✗ ${failed.length} assertions failed`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("\n✓ TCS Offer → UC e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
