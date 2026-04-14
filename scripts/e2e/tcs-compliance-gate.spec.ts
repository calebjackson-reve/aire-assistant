// scripts/e2e/tcs-compliance-gate.spec.ts
// Day 8: Assert TCS compliance gate fires correctly across HIGH / MEDIUM / CLEAN.
//
// Scenarios:
//   A  HIGH  — PENDING_INSPECTION, inspection deadline 10d overdue        → BLOCK
//   C  HIGH  — DRAFT, agency_disclosure missing                            → BLOCK
//   D  HIGH  — UNDER_CONTRACT, property_disclosure missing                 → BLOCK
//   B  MEDIUM — PENDING_INSPECTION, inspection deadline 2d overdue          → ALLOW+WARN
//   E  MEDIUM — UNDER_CONTRACT, no inspector vendor configured             → ALLOW+WARN
//   F  CLEAN  — UNDER_CONTRACT, all required docs + inspector vendor       → ADVANCE
//
// Run: npx tsx scripts/e2e/tcs-compliance-gate.spec.ts

import prisma from "../../lib/prisma"
import { maybeAdvanceStage } from "../../lib/tcs/state-machine"
import type { TCSStage } from "../../lib/tcs/stages"

const TEST_EMAIL_PREFIX = "tcs-gate-e2e"

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

// ── Stage-question bundles (must match stages.ts so stageComplete() returns true) ──
const ANSWERS_BY_STAGE: Record<string, Record<string, string>> = {
  DRAFT: {
    "intake.side": "BUYER",
    "intake.address": "101 Seed St",
    "intake.client": "Seed Client / seed@example.com",
    "intake.competing": "first",
    "intake.listPrice": "250000",
  },
  UNDER_CONTRACT: {
    "uc.titleCompany": "Gulf Coast Title",
    "uc.disclosures": "have",
    "uc.inspector": "mine",
    "uc.lenderSent": "done",
  },
  PENDING_INSPECTION: {
    "insp.outcome": "major",
    "insp.response": "repairs",
    "insp.amount": "2500",
    "insp.send": "now",
  },
}

interface SeedOpts {
  fromStage: TCSStage
  /** If set, creates an overdue deadline matching this stage's keyword. */
  deadlineOverdueDays?: number
  /** Document.type values to pre-seed for the transaction. */
  docTypes?: string[]
  /** Vendor categories to pre-seed for the user. */
  vendorCategories?: string[]
}

async function seed(opts: SeedOpts) {
  const nonce = Date.now() + Math.floor(Math.random() * 100000)
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
      propertyAddress: `${nonce} Compliance St`,
      status: opts.fromStage,
      buyerName: "G E2E",
      buyerEmail: `buyer-${nonce}@example.com`,
      contractDate: new Date(),
      acceptedPrice: 200000,
    },
  })

  if (opts.deadlineOverdueDays && opts.deadlineOverdueDays > 0) {
    const keyword = keywordForStage(opts.fromStage)
    await prisma.deadline.create({
      data: {
        userId: user.id,
        transactionId: tx.id,
        name: `${keyword} Deadline`,
        dueDate: new Date(Date.now() - opts.deadlineOverdueDays * 86400000),
        notes: "seeded overdue",
      },
    })
  }

  for (const type of opts.docTypes ?? []) {
    await prisma.document.create({
      data: {
        transactionId: tx.id,
        name: `Seeded ${type}`,
        type,
        category: "mandatory",
      },
    })
  }

  for (const cat of opts.vendorCategories ?? []) {
    await prisma.vendor.create({
      data: {
        userId: user.id,
        name: `Seed ${cat}`,
        category: cat,
        preferred: true,
      },
    })
  }

  const session = await prisma.tCSSession.create({
    data: {
      userId: user.id,
      transactionId: tx.id,
      side: "BUYER",
      currentStage: opts.fromStage,
      answers: ANSWERS_BY_STAGE[opts.fromStage] ?? {},
    },
  })

  return { user, tx, session }
}

function keywordForStage(stage: TCSStage): string {
  switch (stage) {
    case "UNDER_CONTRACT": return "Earnest Money"
    case "PENDING_INSPECTION": return "Inspection"
    case "PENDING_APPRAISAL": return "Appraisal"
    case "PENDING_FINANCING": return "Financing"
    case "CLOSING": return "Closing"
    default: return "Deadline"
  }
}

async function cleanup(userId: string, txId: string) {
  await prisma.tCSSession.deleteMany({ where: { userId } })
  await prisma.deadline.deleteMany({ where: { transactionId: txId } })
  await prisma.document.deleteMany({ where: { transactionId: txId } })
  await prisma.vendor.deleteMany({ where: { userId } })
  await prisma.transaction.delete({ where: { id: txId } })
  await prisma.user.delete({ where: { id: userId } })
}

async function getSilentSummaries(sessionId: string): Promise<string[]> {
  const row = await prisma.tCSSession.findUnique({
    where: { id: sessionId },
    select: { silentActions: true },
  })
  const actions = (row?.silentActions ?? []) as Array<{ summary: string }>
  return actions.map((a) => a.summary)
}

async function main() {
  console.log("\n═══ TCS E2E: Compliance gate (6 scenarios) ═══\n")

  // ─── A: HIGH deadline (10d overdue) → BLOCK ───────────────────────────────
  console.log("Scenario A: HIGH deadline (10d overdue inspection) must BLOCK")
  const A = await seed({
    fromStage: "PENDING_INSPECTION",
    deadlineOverdueDays: 10,
    docTypes: ["inspection_response"], // required for this stage's exit
  })
  const rA = await maybeAdvanceStage(A.session.id, "system")
  assert("A: blocked=true", rA.blocked === true, `blocked=${rA.blocked}`)
  assert("A: advanced=false", rA.advanced === false)
  assert("A: HIGH issue present", rA.gateIssues?.some((i) => i.severity === "HIGH") === true)
  assert(
    "A: silent action says blocked",
    (await getSilentSummaries(A.session.id)).some((s) => /blocked/i.test(s)),
  )
  await cleanup(A.user.id, A.tx.id)

  // ─── C: HIGH missing agency_disclosure on DRAFT → BLOCK ───────────────────
  console.log("\nScenario C: HIGH missing agency_disclosure on DRAFT must BLOCK")
  const C = await seed({ fromStage: "DRAFT" /* no docs seeded */ })
  const rC = await maybeAdvanceStage(C.session.id, "system")
  assert("C: blocked=true", rC.blocked === true, `blocked=${rC.blocked}`)
  assert("C: advanced=false", rC.advanced === false)
  assert(
    "C: document HIGH issue cites agency_disclosure",
    rC.gateIssues?.some(
      (i) => i.severity === "HIGH" && i.category === "document" && i.payload?.docType === "agency_disclosure",
    ) === true,
  )
  await cleanup(C.user.id, C.tx.id)

  // ─── D: HIGH missing property_disclosure on UC → BLOCK ────────────────────
  console.log("\nScenario D: HIGH missing property_disclosure on UC must BLOCK")
  const D = await seed({
    fromStage: "UNDER_CONTRACT",
    vendorCategories: ["inspector"], // isolate the failure to the missing doc
    // no docs seeded → property_disclosure missing
  })
  const rD = await maybeAdvanceStage(D.session.id, "system")
  assert("D: blocked=true", rD.blocked === true, `blocked=${rD.blocked}`)
  assert(
    "D: HIGH issue cites property_disclosure",
    rD.gateIssues?.some(
      (i) => i.severity === "HIGH" && i.category === "document" && i.payload?.docType === "property_disclosure",
    ) === true,
  )
  await cleanup(D.user.id, D.tx.id)

  // ─── B: MEDIUM deadline (2d overdue) → ALLOW + WARN ───────────────────────
  console.log("\nScenario B: MEDIUM deadline (2d overdue) must ALLOW + warn")
  const B = await seed({
    fromStage: "PENDING_INSPECTION",
    deadlineOverdueDays: 2,
    docTypes: ["inspection_response"],
  })
  const rB = await maybeAdvanceStage(B.session.id, "system")
  assert("B: advanced=true", rB.advanced === true, `err=${rB.error ?? ""}`)
  assert("B: not blocked", !rB.blocked)
  const sessionB = await prisma.tCSSession.findUnique({
    where: { id: B.session.id },
    select: { currentStage: true },
  })
  assert(
    "B: session advanced to PENDING_APPRAISAL",
    sessionB?.currentStage === "PENDING_APPRAISAL",
    sessionB?.currentStage,
  )
  assert(
    "B: silent action warns (no 'blocked' text)",
    (await getSilentSummaries(B.session.id)).some((s) => /warning/i.test(s) && !/blocked/i.test(s)),
  )
  await cleanup(B.user.id, B.tx.id)

  // ─── E: MEDIUM missing inspector vendor on UC → ALLOW + WARN ──────────────
  console.log("\nScenario E: MEDIUM missing inspector vendor on UC must ALLOW + warn")
  const E = await seed({
    fromStage: "UNDER_CONTRACT",
    docTypes: ["property_disclosure", "lead_paint"], // required + optional present
    // no vendors seeded
  })
  const rE = await maybeAdvanceStage(E.session.id, "system")
  assert("E: advanced=true", rE.advanced === true, `err=${rE.error ?? ""}`)
  assert("E: not blocked", !rE.blocked)
  assert(
    "E: MEDIUM data issue cites inspector vendor",
    rE.gateIssues?.some(
      (i) => i.severity === "MEDIUM" && i.category === "data" && i.payload?.vendorCategory === "inspector",
    ) === true,
  )
  await cleanup(E.user.id, E.tx.id)

  // ─── F: CLEAN pass on UC → ADVANCE ────────────────────────────────────────
  console.log("\nScenario F: CLEAN pass on UC → advances to PENDING_INSPECTION")
  const F = await seed({
    fromStage: "UNDER_CONTRACT",
    docTypes: ["property_disclosure", "lead_paint"],
    vendorCategories: ["inspector"],
  })
  const rF = await maybeAdvanceStage(F.session.id, "system")
  assert("F: advanced=true", rF.advanced === true, `err=${rF.error ?? ""}`)
  assert("F: not blocked", !rF.blocked)
  assert(
    "F: no gate issues returned",
    !rF.gateIssues || rF.gateIssues.length === 0,
    `issues=${rF.gateIssues?.length ?? 0}`,
  )
  const sessionF = await prisma.tCSSession.findUnique({
    where: { id: F.session.id },
    select: { currentStage: true },
  })
  assert(
    "F: session advanced to PENDING_INSPECTION",
    sessionF?.currentStage === "PENDING_INSPECTION",
    sessionF?.currentStage,
  )
  await cleanup(F.user.id, F.tx.id)

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS Day 8 compliance gate e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
