// scripts/e2e/tcs-uc-flow.spec.ts
// Day 9: Under-Contract flow — inspector scheduling + earnest-money envelope.
//
// Scenarios:
//   P1  Preferred inspector + title vendors both present        → both upgrades fire; preferred=true
//   P2  Only non-preferred inspector (no preferred)             → picks non-preferred; preferred=false
//   P3  No inspector vendor at all                              → placeholder draft kept; MEDIUM note
//   P4  No title vendor at all                                  → no EM envelope; MEDIUM note
//   P5  Inspector vendor exists with no email                   → warn; draft not updated
//   P6  Title vendor exists with no email                       → warn; envelope NOT created
//   P7  No CommunicationLog with status != "draft" after run    → never auto-sends
//   P8  EM envelope is DRAFT and has TITLE signer               → structural contract holds
//
// Run: npx tsx scripts/e2e/tcs-uc-flow.spec.ts

import prisma from "../../lib/prisma"
import { runUcFlow } from "../../lib/tcs/uc-flow"

const TEST_PREFIX = "tcs-ucflow-e2e"

interface Assertion { label: string; ok: boolean; detail?: string }
const results: Assertion[] = []
function assert(label: string, ok: boolean, detail?: string) {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

interface SeedVendor {
  category: string
  name: string
  email?: string | null
  preferred?: boolean
}

interface SeedOpts {
  vendors?: SeedVendor[]
  /** Simulate auto-messages having already drafted an inspector_booking row. */
  seedInspectorDraft?: boolean
}

async function seed(opts: SeedOpts) {
  const nonce = Date.now() + Math.floor(Math.random() * 100000)
  const user = await prisma.user.create({
    data: {
      clerkId: `${TEST_PREFIX}-${nonce}`,
      email: `${TEST_PREFIX}-${nonce}@aire.test`,
      firstName: "UCFlow",
      lastName: "E2E",
      onboarded: true,
    },
  })
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      propertyAddress: `${nonce} Inspection Ln`,
      status: "UNDER_CONTRACT",
      buyerName: "UC Buyer",
      buyerEmail: `buyer-${nonce}@example.com`,
      buyerPhone: "+12255550100",
      contractDate: new Date(),
      acceptedPrice: 275000,
      offerPrice: 275000,
    },
  })
  const session = await prisma.tCSSession.create({
    data: {
      userId: user.id,
      transactionId: tx.id,
      side: "BUYER",
      currentStage: "UNDER_CONTRACT",
      answers: {
        "uc.titleCompany": "Seed Title",
        "uc.disclosures": "have",
        "uc.inspector": "mine",
        "uc.lenderSent": "done",
        "offer.earnestMoney": "3000",
      },
    },
  })
  for (const v of opts.vendors ?? []) {
    await prisma.vendor.create({
      data: {
        userId: user.id,
        name: v.name,
        company: `${v.name} Co`,
        category: v.category,
        email: v.email === null ? null : v.email ?? `${v.name.toLowerCase().replace(/\s+/g, "")}@vendor.test`,
        phone: "+12255550200",
        preferred: v.preferred ?? false,
      },
    })
  }
  if (opts.seedInspectorDraft) {
    await prisma.communicationLog.create({
      data: {
        userId: user.id,
        channel: "email",
        direction: "outbound",
        fromAddress: user.email,
        toAddress: user.email,
        subject: `Inspection request — ${tx.propertyAddress}`,
        bodyPreview: "placeholder",
        sentAt: new Date(),
        status: "draft",
        draftReply: "<p>placeholder</p>",
        metadata: { source: "tcs", tcsMessageKind: "inspector_booking" },
      },
    })
  }
  return { user, tx, session }
}

async function cleanup(userId: string, txId: string) {
  await prisma.airSignAuditEvent.deleteMany({ where: { envelope: { transactionId: txId } } })
  await prisma.airSignSigner.deleteMany({ where: { envelope: { transactionId: txId } } })
  await prisma.airSignEnvelope.deleteMany({ where: { transactionId: txId } })
  await prisma.document.deleteMany({ where: { transactionId: txId } })
  await prisma.communicationLog.deleteMany({ where: { userId } })
  await prisma.tCSSession.deleteMany({ where: { userId } })
  await prisma.vendor.deleteMany({ where: { userId } })
  await prisma.transaction.delete({ where: { id: txId } })
  await prisma.user.delete({ where: { id: userId } })
}

async function main() {
  console.log("\n═══ TCS E2E: UC Flow (Day 9) ═══\n")

  // ─── P1: preferred inspector + title vendors ─────────────────────────────
  console.log("P1: preferred inspector + title both present → both upgrades fire")
  const s1 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "Ace Preferred", email: "ace.preferred@insp.test", preferred: true },
      { category: "inspector", name: "Backup Insp",   email: "backup@insp.test",       preferred: false },
      { category: "title",     name: "GulfCoast Pref", email: "title.pref@title.test",  preferred: true },
    ],
  })
  const r1 = await runUcFlow({
    sessionId: s1.session.id,
    userId: s1.user.id,
    transactionId: s1.tx.id,
    answers: (s1.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P1: inspector.ok", r1.inspector.ok === true)
  assert("P1: inspector preferred used", r1.inspector.preferredUsed === true)
  assert("P1: earnestMoney.ok", r1.earnestMoney.ok === true)
  assert("P1: earnestMoney preferred used", r1.earnestMoney.preferredUsed === true)
  // Inspector draft now addressed to preferred vendor
  const draft1 = await prisma.communicationLog.findFirst({
    where: { userId: s1.user.id, status: "draft", subject: { contains: "Inspection request" } },
    orderBy: { sentAt: "desc" },
  })
  assert("P1: inspector draft points to preferred vendor", draft1?.toAddress === "ace.preferred@insp.test", draft1?.toAddress)
  // EM envelope created
  const env1 = await prisma.airSignEnvelope.findFirst({
    where: { transactionId: s1.tx.id, name: { contains: "Earnest Money" } },
    include: { signers: true },
  })
  assert("P1: EM envelope exists in DRAFT", env1?.status === "DRAFT", env1?.status)
  assert("P1: EM envelope signers include TITLE role", env1?.signers.some((s) => s.role === "TITLE") === true)
  assert("P1: EM envelope has title vendor email", env1?.signers.find((s) => s.role === "TITLE")?.email === "title.pref@title.test")
  await cleanup(s1.user.id, s1.tx.id)

  // ─── P2: only non-preferred inspector ────────────────────────────────────
  console.log("\nP2: only non-preferred inspector → picked, preferred=false")
  const s2 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "Solo Inspector", email: "solo@insp.test", preferred: false },
      { category: "title",     name: "Solo Title",     email: "solo@title.test", preferred: false },
    ],
  })
  const r2 = await runUcFlow({
    sessionId: s2.session.id,
    userId: s2.user.id,
    transactionId: s2.tx.id,
    answers: (s2.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P2: inspector.ok", r2.inspector.ok === true)
  assert("P2: inspector preferredUsed=false", r2.inspector.preferredUsed === false)
  const draft2 = await prisma.communicationLog.findFirst({
    where: { userId: s2.user.id, status: "draft", subject: { contains: "Inspection request" } },
  })
  assert("P2: inspector draft points to solo vendor", draft2?.toAddress === "solo@insp.test", draft2?.toAddress)
  await cleanup(s2.user.id, s2.tx.id)

  // ─── P3: no inspector vendor → placeholder retained ──────────────────────
  console.log("\nP3: no inspector vendor → placeholder draft retained + note")
  const s3 = await seed({
    seedInspectorDraft: true,
    vendors: [{ category: "title", name: "Only Title", email: "only@title.test", preferred: true }],
  })
  const r3 = await runUcFlow({
    sessionId: s3.session.id,
    userId: s3.user.id,
    transactionId: s3.tx.id,
    answers: (s3.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P3: inspector.ok=false", r3.inspector.ok === false)
  // Draft still there, still placeholder subject
  const draft3 = await prisma.communicationLog.findFirst({
    where: { userId: s3.user.id, status: "draft", subject: { contains: "Inspection request" } },
  })
  assert("P3: placeholder draft still present", !!draft3)
  assert("P3: silent-action note surfaces missing vendor",
    r3.actions.some((a) => /inspector/i.test(a.summary) && /add one/i.test(a.summary)))
  await cleanup(s3.user.id, s3.tx.id)

  // ─── P4: no title vendor → no EM envelope ────────────────────────────────
  console.log("\nP4: no title vendor → no EM envelope")
  const s4 = await seed({
    seedInspectorDraft: true,
    vendors: [{ category: "inspector", name: "Only Insp", email: "only@insp.test", preferred: true }],
  })
  const r4 = await runUcFlow({
    sessionId: s4.session.id,
    userId: s4.user.id,
    transactionId: s4.tx.id,
    answers: (s4.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P4: earnestMoney.ok=false", r4.earnestMoney.ok === false)
  const env4Count = await prisma.airSignEnvelope.count({
    where: { transactionId: s4.tx.id, name: { contains: "Earnest Money" } },
  })
  assert("P4: no EM envelope created", env4Count === 0, `count=${env4Count}`)
  await cleanup(s4.user.id, s4.tx.id)

  // ─── P5: inspector vendor with no email ──────────────────────────────────
  console.log("\nP5: inspector vendor with no email → warn; draft unchanged")
  const s5 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "NoEmail Insp", email: null, preferred: true },
      { category: "title",     name: "Solo Title",   email: "solo@title.test", preferred: true },
    ],
  })
  const draft5Before = await prisma.communicationLog.findFirst({
    where: { userId: s5.user.id, status: "draft", subject: { contains: "Inspection request" } },
    select: { toAddress: true },
  })
  const r5 = await runUcFlow({
    sessionId: s5.session.id,
    userId: s5.user.id,
    transactionId: s5.tx.id,
    answers: (s5.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P5: inspector.ok=false", r5.inspector.ok === false)
  const draft5After = await prisma.communicationLog.findFirst({
    where: { userId: s5.user.id, status: "draft", subject: { contains: "Inspection request" } },
    select: { toAddress: true },
  })
  assert("P5: draft toAddress unchanged", draft5After?.toAddress === draft5Before?.toAddress)
  await cleanup(s5.user.id, s5.tx.id)

  // ─── P6: title vendor with no email ──────────────────────────────────────
  console.log("\nP6: title vendor with no email → warn; no envelope")
  const s6 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "Solo Insp",   email: "solo@insp.test", preferred: true },
      { category: "title",     name: "NoEmail Tit", email: null,             preferred: true },
    ],
  })
  const r6 = await runUcFlow({
    sessionId: s6.session.id,
    userId: s6.user.id,
    transactionId: s6.tx.id,
    answers: (s6.session.answers as Record<string, unknown>) ?? {},
  })
  assert("P6: earnestMoney.ok=false", r6.earnestMoney.ok === false)
  const env6Count = await prisma.airSignEnvelope.count({
    where: { transactionId: s6.tx.id, name: { contains: "Earnest Money" } },
  })
  assert("P6: no EM envelope created", env6Count === 0, `count=${env6Count}`)
  await cleanup(s6.user.id, s6.tx.id)

  // ─── P7: never auto-sends ────────────────────────────────────────────────
  console.log("\nP7: no sends — all CommunicationLog rows must have status=draft")
  const s7 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "Ace", email: "ace@insp.test", preferred: true },
      { category: "title",     name: "Pref Title", email: "pref@title.test", preferred: true },
    ],
  })
  await runUcFlow({
    sessionId: s7.session.id,
    userId: s7.user.id,
    transactionId: s7.tx.id,
    answers: (s7.session.answers as Record<string, unknown>) ?? {},
  })
  const nonDraft = await prisma.communicationLog.count({
    where: { userId: s7.user.id, status: { not: "draft" } },
  })
  assert("P7: zero non-draft CommunicationLog rows", nonDraft === 0, `count=${nonDraft}`)
  await cleanup(s7.user.id, s7.tx.id)

  // ─── P8: EM envelope structural contract ─────────────────────────────────
  console.log("\nP8: EM envelope status=DRAFT, TITLE signer, documentUrl present")
  const s8 = await seed({
    seedInspectorDraft: true,
    vendors: [
      { category: "inspector", name: "Ace", email: "ace@insp.test", preferred: true },
      { category: "title",     name: "Pref Title", email: "pref@title.test", preferred: true },
    ],
  })
  await runUcFlow({
    sessionId: s8.session.id,
    userId: s8.user.id,
    transactionId: s8.tx.id,
    answers: (s8.session.answers as Record<string, unknown>) ?? {},
  })
  const env8 = await prisma.airSignEnvelope.findFirst({
    where: { transactionId: s8.tx.id, name: { contains: "Earnest Money" } },
    include: { signers: true },
  })
  assert("P8: envelope status === DRAFT", env8?.status === "DRAFT")
  assert("P8: envelope has TITLE signer", env8?.signers.some((s) => s.role === "TITLE") === true)
  assert("P8: envelope has documentUrl", !!env8?.documentUrl)
  const audit = await prisma.airSignAuditEvent.findFirst({
    where: { envelopeId: env8?.id ?? "", action: "created" },
  })
  assert("P8: audit event action=created logged", !!audit)
  await cleanup(s8.user.id, s8.tx.id)

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${passed}/${results.length} assertions passed`)
  if (failed.length > 0) {
    console.log(`✗ ${failed.length} failures:`)
    for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`)
    process.exit(1)
  }
  console.log("✓ TCS Day 9 UC-flow e2e PASSED")
  process.exit(0)
}

main().catch((err) => {
  console.error("\n✗ Spec threw:", err)
  process.exit(1)
})
