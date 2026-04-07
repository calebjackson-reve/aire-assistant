/**
 * Unit tests for lib/comms/email-classifier.ts
 *
 * Run:
 *   set -a && source .env.local && set +a && npx tsx scripts/test-email-classifier.ts
 *
 * Tests Tier 1 deterministically and Tier 2 (Haiku) if ANTHROPIC_API_KEY is set.
 */

import {
  classifyEmail,
  classifyTier1,
  type ClassifierContext,
  type EmailInput,
  type ClassificationResult,
} from "../lib/comms/email-classifier"

// ─── Fixture: active transactions ───────────────────────────────────────────

const CTX: ClassifierContext = {
  activeTransactions: [
    {
      id: "txn_guice",
      propertyAddress: "5834 Guice Dr",
      propertyCity: "Baton Rouge",
      mlsNumber: "2024123456",
      buyerName: "John Smith",
      buyerEmail: "jsmith@gmail.com",
      sellerName: "Mary Thompson",
      sellerEmail: "mary.t@yahoo.com",
      lenderName: "Rocket Mortgage",
      titleCompany: "Louisiana Title Group",
    },
    {
      id: "txn_magnolia",
      propertyAddress: "12 Magnolia Lane",
      propertyCity: "Baton Rouge",
      mlsNumber: null,
      buyerName: "Robert Johnson",
      buyerEmail: null,
      sellerName: null,
      sellerEmail: null,
      lenderName: null,
      titleCompany: null,
    },
  ],
  vendorEmails: ["inspector@brhomeinspections.com"],
}

// ─── Test cases ─────────────────────────────────────────────────────────────

interface TestCase {
  name: string
  email: EmailInput
  expect: {
    category: ClassificationResult["category"]
    tier?: 1 | 2
    matchedTransactionId?: string
  }
}

const CASES: TestCase[] = [
  // Deal-related: direct signals
  {
    name: "T1: address in subject → deal_related",
    email: {
      from: "Agent Jane <jane@kw.com>",
      subject: "Re: Offer on 5834 Guice Dr",
      body: "My buyer wants to counter at $165k. Can we talk today?",
    },
    expect: { category: "deal_related", tier: 1, matchedTransactionId: "txn_guice" },
  },
  {
    name: "T1: MLS number in body → deal_related",
    email: {
      from: "title@somecompany.com",
      subject: "Title update",
      body: "Your MLS 2024123456 title commitment is ready.",
    },
    expect: { category: "deal_related", tier: 1, matchedTransactionId: "txn_guice" },
  },
  {
    name: "T1: known buyer email → deal_related",
    email: {
      from: "John Smith <jsmith@gmail.com>",
      subject: "Question about closing",
      body: "Hey Caleb, quick question about the closing next week.",
    },
    expect: { category: "deal_related", tier: 1, matchedTransactionId: "txn_guice" },
  },
  {
    name: "T1: known seller email → deal_related",
    email: {
      from: "mary.t@yahoo.com",
      subject: "Docs",
      body: "Attached is what you asked for.",
    },
    expect: { category: "deal_related", tier: 1, matchedTransactionId: "txn_guice" },
  },
  {
    name: "T1: party last name + RE keyword → deal_related",
    email: {
      from: "random@example.com",
      subject: "Johnson inspection report",
      body: "Inspection for your buyer Johnson is complete. Report attached.",
    },
    expect: { category: "deal_related", tier: 1, matchedTransactionId: "txn_magnolia" },
  },

  // Work-related
  {
    name: "T1: MLS keyword, no specific deal → work_related",
    email: {
      from: "newlistings@gbrmls.com",
      subject: "New listings matching your search",
      body: "3 new listings in the Louisiana market. Check the MLS for details on these broker tours.",
    },
    expect: { category: "work_related", tier: 1 },
  },
  {
    name: "T1: known vendor sender → work_related",
    email: {
      from: "inspector@brhomeinspections.com",
      subject: "Availability this week",
      body: "I have openings Tuesday and Thursday.",
    },
    expect: { category: "work_related", tier: 1 },
  },
  {
    name: "T1: work domain → work_related",
    email: {
      from: "rep@firstam.com",
      subject: "Your title quote",
      body: "Attached please find the quote.",
    },
    expect: { category: "work_related", tier: 1 },
  },
  {
    name: "T1: multi-keyword RE content → work_related",
    email: {
      from: "some@domain.com",
      subject: "LREC commission advisory update",
      body: "Dear broker, the LREC has updated commission disclosure guidance for all listing agents. See attached.",
    },
    expect: { category: "work_related", tier: 1 },
  },

  // Personal
  {
    name: "T1: Amazon receipt → personal",
    email: {
      from: "auto-confirm@amazon.com",
      subject: "Your Amazon.com order of \"USB-C Cable\" has shipped",
      body: "Your order has shipped. Track your delivery here. Unsubscribe.",
    },
    expect: { category: "personal", tier: 1 },
  },
  {
    name: "T1: newsletter → personal",
    email: {
      from: "news@someblog.com",
      subject: "Weekly digest — 5 stories you missed",
      body: "This week's newsletter. Unsubscribe if you no longer want these.",
    },
    expect: { category: "personal", tier: 1 },
  },
  {
    name: "T1: password reset → personal",
    email: {
      from: "noreply@randomapp.io",
      subject: "Verify your email",
      body: "Click here to verify your email and complete 2-factor setup.",
    },
    expect: { category: "personal", tier: 1 },
  },

  // Ambiguous → Tier 2
  {
    name: "T2: vague family note → personal (Tier 2)",
    email: {
      from: "mom@family.com",
      subject: "Dinner Sunday?",
      body: "Hey honey, are you free for dinner Sunday at 6? Love you.",
    },
    expect: { category: "personal", tier: 2 },
  },
  {
    name: "T2: generic client inquiry no address → work_related (Tier 2)",
    email: {
      from: "prospect@gmail.com",
      subject: "Looking to buy a house",
      body: "Hi, I was referred to you. Looking for a 3-bedroom in the area. Can we chat?",
    },
    expect: { category: "work_related", tier: 2 },
  },
  {
    name: "T2: one-keyword ambiguous → Tier 2",
    email: {
      from: "friend@gmail.com",
      subject: "Closing thoughts",
      body: "Just wanted to share some closing thoughts on our conversation yesterday.",
    },
    expect: { category: "personal", tier: 2 },
  },
]

// ─── Runner ─────────────────────────────────────────────────────────────────

async function run() {
  let passed = 0
  let failed = 0
  const failures: string[] = []
  const hasKey = !!process.env.ANTHROPIC_API_KEY

  console.log(`\n═══ AIRE Email Classifier Test Suite ═══`)
  console.log(`Tier 2 (Haiku) available: ${hasKey ? "YES" : "NO (skipping T2 cases)"}\n`)

  for (const tc of CASES) {
    const usesTier2 = tc.expect.tier === 2
    if (usesTier2 && !hasKey) {
      console.log(`SKIP  ${tc.name}  (no API key)`)
      continue
    }

    // Use Tier 1 only for tier-1 cases (deterministic, no API), full pipeline otherwise
    const result: ClassificationResult | null = usesTier2
      ? await classifyEmail(tc.email, CTX)
      : classifyTier1(tc.email, CTX)

    const got = result
    const ok =
      got !== null &&
      got.category === tc.expect.category &&
      (tc.expect.tier === undefined || got.tier === tc.expect.tier) &&
      (tc.expect.matchedTransactionId === undefined ||
        got.matchedTransactionId === tc.expect.matchedTransactionId)

    if (ok) {
      passed++
      console.log(
        `PASS  ${tc.name}  →  ${got!.category} (t${got!.tier}, ${(got!.confidence * 100).toFixed(0)}%)`
      )
    } else {
      failed++
      const msg = `${tc.name}\n       expected=${JSON.stringify(tc.expect)}\n       got=${JSON.stringify(got)}`
      failures.push(msg)
      console.log(`FAIL  ${msg}`)
    }
  }

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed, ${CASES.length} total ═══\n`)
  if (failed > 0) {
    console.log("FAILURES:")
    failures.forEach((f) => console.log("  - " + f))
    process.exit(1)
  }
}

run().catch((err) => {
  console.error("Test runner crashed:", err)
  process.exit(1)
})
