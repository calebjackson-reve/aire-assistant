// scripts/e2e/tcs-compliance-gate.spec.ts
// Day 8: Assert that the TCS state machine gates stage advances on compliance.
// Two scenarios:
//   A) HIGH severity (inspection deadline 10 days overdue) → advance BLOCKED
//   B) MEDIUM severity (inspection deadline 2 days overdue) → advance ALLOWED
//      with a warning silent action.
//
// Run: npx tsx scripts/e2e/tcs-compliance-gate.spec.ts

import prisma from "../../lib/prisma"
import { maybeAdvanceStage } from "../../lib/tcs/state-machine"

const TEST_EMAIL_PREFIX = "tcs-gate-e2e"

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

// Seed a txn + in-flight TCSSession at PENDING_INSPECTION with all stage
// questions already answered so stageComplete() passes (forcing advance attempt)
async function seedScenario(daysOverdue: number) {
  const nonce = Date.now() + Math.floor(Math.random() * 10000)
  const user = await prisma.user.create({
    data: {
      clerkId: `${TEST_EMAIL_PREFIX}-${nonce}`,
      email: `${TEST_EMAIL_PREFIX}-${nonce}@aire.test`,
      firstName: "Gate",
      lastName: "E2E",
      onboarded: true,
    },
  })
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      propertyAddress: "1212 Compliance St",
      status: "PENDING_INSPECTION",
      buyerName: "G E2E",
      buyerEmail: `buyer-${nonce}@example.com`,
      contractDate: new Date(),
      acceptedPrice: 200000,
    },
  })
  // Overdue inspection deadline
  await prisma.deadline.create({
    data: {
      userId: user.id,
      transactionId: tx.id,
      name: "Inspection Deadline",
      dueDate: new Date(Date.now() - daysOverdue * 86400000),
      notes: "seeded overdue",
    },
  })
  // TCS session with PENDING_INSPECTION stage-questions already answered
  // so stageComplete() returns true → advance is attempted → gate fires
  const session = await prisma.tCSSession.create({
    data: {
      userId: user.id,
      transactionId: tx.id,
      side: "BUYER",
      currentStage: "PENDING_INSPECTION",
      answers: {
        "insp.outcome": "major",
        "insp.response": "repairs",
        "insp.amount": "2500",
        "insp.send": "now",
      },
    },
  })
  return { user, tx, session }
}

async function cleanup(userId: string, txId: string) {
  await prisma.tCSSession.deleteMany({ where: { userId } })
  await prisma.deadline.deleteMany({ where: { transactionId: txId } })
  await prisma.transaction.delete({ where: { id: txId } })
  await prisma.user.delete({ where: { id: userId } })
}

async function main() {
  console.log("\n═══ TCS E2E: Compliance gate ═══\n")

  // ── Scenario A: HIGH (10 days overdue) → BLOCK ───────────────────────────
  console.log("Scenario A: HIGH severity (10d overdue) must block advance")
  const A = await seedScenario(10)
  const resultA = await maybeAdvanceStage(A.session.id, "system")
  assert("A: advance blocked", resultA.blocked === true && resultA.advanced === false, `blocked=${resultA.blocked} advanced=${resultA.advanced}`)
  assert("A: issues returned", (resultA.gateIssues?.length ?? 0) >= 1, `count=${resultA.gateIssues?.length ?? 0}`)
  assert("A: at least one HIGH severity issue", resultA.gateIssues?.some((i) => i.severity === "HIGH") === true)
  // Verify session did NOT advance
  const sessionA = await prisma.tCSSession.findUnique({ where: { id: A.session.id }, select: { currentStage: true } })
  assert("A: session stayed at PENDING_INSPECTION", sessionA?.currentStage === "PENDING_INSPECTION", sessionA?.currentStage)
  // Silent action logged
  const silentA = ((await prisma.tCSSession.findUnique({ where: { id: A.session.id }, select: { silentActions: true } }))
    ?.silentActions ?? []) as Array<{ kind: string; summary: string }>
  assert(
    "A: silent action summarizes blocking",
    silentA.some((a) => /blocked/i.test(a.summary)),
    silentA.map((a) => a.summary).join(" | "),
  )
  await cleanup(A.user.id, A.tx.id)

  // ── Scenario B: MEDIUM (2 days overdue) → ALLOW but warn ─────────────────
  console.log("\nScenario B: MEDIUM severity (2d overdue) must allow advance + warn")
  const B = await seedScenario(2)
  const resultB = await maybeAdvanceStage(B.session.id, "system")
  assert("B: advance allowed", resultB.advanced === true, `advanced=${resultB.advanced} error=${resultB.error ?? ""}`)
  assert("B: not blocked", !resultB.blocked)
  // Verify session advanced
  const sessionB = await prisma.tCSSession.findUnique({ where: { id: B.session.id }, select: { currentStage: true } })
  assert("B: session advanced to PENDING_APPRAISAL", sessionB?.currentStage === "PENDING_APPRAISAL", sessionB?.currentStage)
  const silentB = ((await prisma.tCSSession.findUnique({ where: { id: B.session.id }, select: { silentActions: true } }))
    ?.silentActions ?? []) as Array<{ kind: string; summary: string }>
  assert(
    "B: silent action warns but does not block",
    silentB.some((a) => /warning/i.test(a.summary)) && !silentB.some((a) => /blocked/i.test(a.summary)),
    silentB.map((a) => a.summary).join(" | "),
  )
  await cleanup(B.user.id, B.tx.id)

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS compliance gate e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
