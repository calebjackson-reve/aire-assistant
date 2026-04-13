// scripts/e2e/tcs-multi-tenant.spec.ts
// Day 9: Assert multi-tenant scoping:
//   - Brokerage A agent CANNOT read Brokerage B transaction
//   - Brokerage A OWNER CAN read any Brokerage A transaction
//   - Solo-agent user can only read their own transactions
//
// Tests the scopedTransactionWhere helper directly via Prisma, simulating
// the behavior every /api/transactions/* route now has.
//
// Run: npx tsx scripts/e2e/tcs-multi-tenant.spec.ts

import prisma from "../../lib/prisma"
import {
  getScopedContext,
  scopedTransactionWhere,
  findScopedTransaction,
  isCrossTenantDenied,
} from "../../lib/tcs/scoped-prisma"

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

async function main() {
  console.log("\n═══ TCS E2E: multi-tenant scoping ═══\n")

  const n = Date.now()

  // ── Seed: 2 brokerages, each with 1 owner + 1 agent + 1 transaction ──────
  const brA = await prisma.brokerage.create({
    data: { name: "Brokerage A", slug: `brok-a-${n}` },
  })
  const brB = await prisma.brokerage.create({
    data: { name: "Brokerage B", slug: `brok-b-${n}` },
  })

  const ownerA = await prisma.user.create({
    data: { clerkId: `ownerA-${n}`, email: `ownerA-${n}@aire.test`, onboarded: true },
  })
  const agentA = await prisma.user.create({
    data: { clerkId: `agentA-${n}`, email: `agentA-${n}@aire.test`, onboarded: true },
  })
  const agentB = await prisma.user.create({
    data: { clerkId: `agentB-${n}`, email: `agentB-${n}@aire.test`, onboarded: true },
  })
  const solo = await prisma.user.create({
    data: { clerkId: `solo-${n}`, email: `solo-${n}@aire.test`, onboarded: true },
  })

  await prisma.brokerageMember.createMany({
    data: [
      { userId: ownerA.id, brokerageId: brA.id, role: "OWNER" },
      { userId: agentA.id, brokerageId: brA.id, role: "AGENT" },
      { userId: agentB.id, brokerageId: brB.id, role: "AGENT" },
    ],
  })

  const txA = await prisma.transaction.create({
    data: {
      userId: agentA.id,
      propertyAddress: "100 A St",
      brokerageId: brA.id,
      status: "ACTIVE",
    },
  })
  const txB = await prisma.transaction.create({
    data: {
      userId: agentB.id,
      propertyAddress: "200 B St",
      brokerageId: brB.id,
      status: "ACTIVE",
    },
  })
  const txSolo = await prisma.transaction.create({
    data: {
      userId: solo.id,
      propertyAddress: "300 Solo St",
      status: "ACTIVE",
    },
  })

  // ── Context resolution ────────────────────────────────────────────────────
  const ctxOwnerA = await getScopedContext(ownerA.id)
  assert("ownerA role OWNER", ctxOwnerA.role === "OWNER", ctxOwnerA.role)
  assert("ownerA brokerageId = brA", ctxOwnerA.brokerageId === brA.id)

  const ctxAgentA = await getScopedContext(agentA.id)
  assert("agentA role AGENT", ctxAgentA.role === "AGENT", ctxAgentA.role)

  const ctxSolo = await getScopedContext(solo.id)
  assert("solo role AGENT (default)", ctxSolo.role === "AGENT")
  assert("solo brokerageId null", ctxSolo.brokerageId === null)

  // ── Owner A can read everything in brokerage A ────────────────────────────
  const ownerAList = await prisma.transaction.findMany({
    where: scopedTransactionWhere(ctxOwnerA),
    select: { id: true },
  })
  const ownerAIds = new Set(ownerAList.map((t) => t.id))
  assert("owner A sees txA", ownerAIds.has(txA.id))
  assert("owner A cannot see txB", !ownerAIds.has(txB.id))
  assert("owner A cannot see txSolo", !ownerAIds.has(txSolo.id))

  // ── Agent A only sees own transactions (txA) ──────────────────────────────
  const agentAList = await prisma.transaction.findMany({
    where: scopedTransactionWhere(ctxAgentA),
    select: { id: true },
  })
  const agentAIds = new Set(agentAList.map((t) => t.id))
  assert("agent A sees own txA", agentAIds.has(txA.id))
  assert("agent A cannot see txB (cross-brokerage)", !agentAIds.has(txB.id))

  // ── Agent B cannot read txA (cross-brokerage) ─────────────────────────────
  const deniedCross = await isCrossTenantDenied(agentB.id, txA.id)
  assert("agent B denied reading txA", deniedCross)

  // ── Agent A cannot read txB ───────────────────────────────────────────────
  const res = await findScopedTransaction(agentA.id, txB.id)
  assert("agent A findScopedTransaction(txB) denied", !res.allowed)

  // ── Solo user cannot see brokerage transactions ──────────────────────────
  const soloList = await prisma.transaction.findMany({
    where: scopedTransactionWhere(ctxSolo),
    select: { id: true },
  })
  const soloIds = new Set(soloList.map((t) => t.id))
  assert("solo sees own txSolo", soloIds.has(txSolo.id))
  assert("solo cannot see txA", !soloIds.has(txA.id))
  assert("solo cannot see txB", !soloIds.has(txB.id))

  // ── Cleanup ──────────────────────────────────────────────────────────────
  if (process.env.TCS_E2E_KEEP !== "1") {
    await prisma.transaction.deleteMany({
      where: { id: { in: [txA.id, txB.id, txSolo.id] } },
    })
    await prisma.brokerageMember.deleteMany({
      where: { userId: { in: [ownerA.id, agentA.id, agentB.id] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerA.id, agentA.id, agentB.id, solo.id] } },
    })
    await prisma.brokerage.deleteMany({ where: { id: { in: [brA.id, brB.id] } } })
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS multi-tenant e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
