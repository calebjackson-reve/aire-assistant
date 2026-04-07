/**
 * TC Deadlines + Communications test (Closer / Agent 1)
 *
 * Exercises:
 *   - Mark a deadline complete and verify DB + workflow side-effects
 *   - Quick-send templates (Offer Accepted, Inspection Scheduled, Closing Reminder, Status Update)
 *
 * Run: npx tsx --env-file=.env.local scripts/test-tc-deadlines-and-comms.ts
 */

import "dotenv/config"
import prisma from "../lib/prisma"
import { onDeadlineCompleted } from "../lib/workflow/state-machine"
import { sendPartyUpdate, type TemplateContext, type PartyInfo, type TemplateType } from "../lib/tc/party-communications"

function pass(msg: string) { console.log("  PASS:", msg) }
function fail(msg: string): never { console.log("  FAIL:", msg); process.exit(1) }

async function main() {
  console.log("=== TC Deadlines + Communications E2E ===\n")

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } })
  if (!user) fail("No user")

  // Find or create a transaction with pending deadlines
  let txn = await prisma.transaction.findFirst({
    where: {
      userId: user.id,
      deadlines: { some: { completedAt: null } },
      buyerEmail: { not: null },
    },
    include: { deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" } } },
  })

  if (!txn) {
    console.log("Creating test transaction with deadlines...")
    const created = await prisma.transaction.create({
      data: {
        userId: user.id,
        propertyAddress: "555 Closer Test Ln",
        city: "Baton Rouge",
        state: "LA",
        zipCode: "70808",
        type: "BUYER_REPRESENTATION",
        status: "PENDING_INSPECTION",
        acceptedPrice: 250000,
        buyerName: "Test Buyer",
        buyerEmail: "buyer@test.com",
        sellerName: "Test Seller",
        sellerEmail: "seller@test.com",
        contractDate: new Date(),
        closingDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        deadlines: {
          create: [
            { userId: user.id, name: "Inspection Deadline", dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000) },
            { userId: user.id, name: "Appraisal Deadline", dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000) },
          ],
        },
      },
      include: { deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" } } },
    })
    txn = created
  }

  console.log(`  Using txn ${txn.id} (${txn.propertyAddress}) status=${txn.status}`)
  console.log(`  Pending deadlines: ${txn.deadlines.length}\n`)

  // ── PART 1: Mark Complete ──
  console.log("PART 1: Mark Deadline Complete")
  const deadline = txn.deadlines[0]
  if (!deadline) fail("No pending deadline to complete")
  console.log(`  Completing "${deadline.name}" (id=${deadline.id})`)

  // Simulate POST /api/transactions/[id]/deadlines with action=complete
  if (deadline.completedAt) fail("Deadline already completed")

  const updated = await prisma.deadline.update({
    where: { id: deadline.id },
    data: { completedAt: new Date(), notes: "Closer test completion" },
  })
  if (!updated.completedAt) fail("completedAt not set")
  pass(`Deadline completedAt=${updated.completedAt.toISOString()}`)

  const advance = await onDeadlineCompleted(txn.id, deadline.name, user.id)
  if (advance?.success) {
    pass(`Workflow advanced ${advance.fromStatus} -> ${advance.toStatus}`)
  } else {
    console.log(`  INFO: No auto-advance (${advance?.error || "n/a"})`)
  }

  // Verify it's removed from pending list
  const stillPending = await prisma.deadline.findFirst({
    where: { transactionId: txn.id, id: deadline.id, completedAt: null },
  })
  if (stillPending) fail("Deadline still appears as pending")
  pass("Deadline removed from pending list")

  // ── PART 2: Quick-send templates ──
  console.log("\nPART 2: Quick-Send Communications Templates")

  const ctx: TemplateContext = {
    propertyAddress: txn.propertyAddress,
    agentName: [user.firstName, user.lastName].filter(Boolean).join(" ") || "AIRE Agent",
    buyerName: txn.buyerName,
    sellerName: txn.sellerName,
    price: txn.acceptedPrice || txn.listPrice,
    date: txn.closingDate ? new Date(txn.closingDate).toLocaleDateString() : null,
    status: txn.status.replace(/_/g, " ").toLowerCase(),
  }

  const parties: PartyInfo[] = [
    { name: txn.buyerName!, email: txn.buyerEmail, role: "buyer" },
    { name: txn.sellerName!, email: txn.sellerEmail, role: "seller" },
  ]

  const templates: TemplateType[] = [
    "offer_accepted",
    "inspection_scheduled",
    "closing_reminder",
    "status_update",
  ]

  // Resend free tier throttles at 2 req/sec. Sleep 700ms between each email so we stay under.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
  for (const t of templates) {
    console.log(`  Sending ${t}...`)
    const results = []
    for (const p of parties) {
      await sleep(700)
      results.push(await sendPartyUpdate(t, ctx, p))
    }
    const okCount = results.filter((r) => r.emailSent).length
    if (okCount !== results.length) {
      fail(`Template ${t}: only ${okCount}/${results.length} emails sent. Errors: ${JSON.stringify(results)}`)
    }
    pass(`${t} -> ${okCount}/${results.length} parties`)
  }

  // ── Cleanup ──
  console.log("\nCleanup...")
  // Restore deadline to pending so subsequent runs still have data
  await prisma.deadline.update({
    where: { id: deadline.id },
    data: { completedAt: null, notes: null },
  })
  // Reset workflow if we advanced
  if (advance?.success) {
    await prisma.transaction.update({
      where: { id: txn.id },
      data: { status: advance.fromStatus },
    })
    await prisma.workflowEvent.deleteMany({
      where: { transactionId: txn.id, trigger: "deadline_completed" },
    })
  }
  pass("State restored")

  console.log("\n=== TC Deadlines + Comms: ALL PASS ===")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("FAIL:", e)
  await prisma.$disconnect()
  process.exit(1)
})
