// scripts/e2e/tcs-auto-messages.spec.ts
// Day 6: Assert that UNDER_CONTRACT entry creates 5 CommunicationLog rows with
// status="draft" and metadata.source="tcs".
//
// Run: npx tsx scripts/e2e/tcs-auto-messages.spec.ts

import prisma from "../../lib/prisma"
import { createSession, submitAnswer } from "../../lib/tcs/conversation-engine"

const TEST_EMAIL = "tcs-messages-e2e@aire.test"
const TEST_ADDRESS = "8821 Highland Rd"

function futureDateISO(d: number) {
  const x = new Date()
  x.setDate(x.getDate() + d)
  return x.toISOString().slice(0, 10)
}

const SCRIPT = [
  { key: "intake.side", value: "BUYER" },
  { key: "intake.address", value: TEST_ADDRESS },
  { key: "intake.client", value: "Msg Test / msg.test@example.com" },
  { key: "intake.competing", value: "first" },
  { key: "intake.listPrice", value: "325000" },
  { key: "offer.price", value: "319000" },
  { key: "offer.financing", value: "CONVENTIONAL" },
  { key: "offer.earnestMoney", value: "5000" },
  { key: "offer.inspectionDays", value: "10" },
  { key: "offer.closingDate", value: futureDateISO(45) },
]

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

async function main() {
  console.log("\n═══ TCS E2E: Auto-messages on UC entry ═══\n")

  let user = await prisma.user.findFirst({ where: { email: TEST_EMAIL } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: `tcs-msg-e2e-${Date.now()}`,
        email: TEST_EMAIL,
        firstName: "TCS",
        lastName: "MsgE2E",
        onboarded: true,
      },
    })
  }
  console.log(`  Setup  user ${user.id}`)

  const session = await createSession(user.id, "BUYER")
  let turn
  for (const step of SCRIPT) {
    turn = await submitAnswer({
      sessionId: session.sessionId,
      userId: user.id,
      questionKey: step.key,
      answer: step.value,
    })
  }

  const transactionId = turn?.session.transactionId
  assert("Session advanced to UNDER_CONTRACT", turn?.session.currentStage === "UNDER_CONTRACT", turn?.session.currentStage)
  assert("Transaction created", !!transactionId, transactionId ?? "none")

  if (!transactionId) process.exit(1)

  // Assertions on drafted CommunicationLog rows
  const drafts = await prisma.communicationLog.findMany({
    where: {
      userId: user.id,
      status: "draft",
      // metadata filter isn't directly supported, filter in app code
    },
    orderBy: { createdAt: "asc" },
  })
  const tcsDrafts = drafts.filter((d) => {
    const m = (d.metadata as Record<string, unknown> | null) ?? {}
    return m.source === "tcs" && m.transactionId === transactionId
  })

  assert("5 TCS drafts created", tcsDrafts.length === 5, `got ${tcsDrafts.length}`)

  for (const kind of [
    "buyer_offer_summary",
    "listing_agent_intro",
    "title_intro",
    "lender_intro",
    "inspector_booking",
  ]) {
    const hit = tcsDrafts.find(
      (d) => ((d.metadata as Record<string, unknown>).tcsMessageKind as string) === kind,
    )
    assert(`Draft exists for ${kind}`, !!hit, hit?.subject)
    assert(`${kind} status is draft`, hit?.status === "draft", hit?.status ?? "none")
    assert(`${kind} has subject + body`, !!hit?.subject && !!hit?.draftReply, `subj=${(hit?.subject ?? "").length}c body=${(hit?.draftReply ?? "").length}c`)
  }

  // The conversation engine should have logged a silent action summarising drafts
  const tcsSession = await prisma.tCSSession.findUnique({
    where: { id: session.sessionId },
    select: { silentActions: true },
  })
  const actions = (tcsSession?.silentActions as Array<{ kind: string; summary: string }>) ?? []
  const msgAction = actions.find((a) => a.kind === "message_drafted")
  assert("silent action logged: message_drafted", !!msgAction, msgAction?.summary)

  // Cleanup
  if (process.env.TCS_E2E_KEEP !== "1") {
    await prisma.communicationLog.deleteMany({ where: { userId: user.id } })
    await prisma.deadline.deleteMany({ where: { transactionId } })
    await prisma.airSignField.deleteMany({ where: { envelope: { transactionId } } })
    await prisma.airSignAuditEvent.deleteMany({ where: { envelope: { transactionId } } })
    await prisma.airSignSigner.deleteMany({ where: { envelope: { transactionId } } })
    await prisma.airSignEnvelope.deleteMany({ where: { transactionId } })
    await prisma.document.deleteMany({ where: { transactionId } })
    await prisma.workflowEvent.deleteMany({ where: { transactionId } })
    await prisma.tCSSession.deleteMany({ where: { userId: user.id } })
    await prisma.transaction.delete({ where: { id: transactionId } })
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS auto-messages e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
