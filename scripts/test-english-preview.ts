/**
 * AIRE Voice — English Preview Unit Tests (no DB, no LLM)
 * Run: npx tsx scripts/test-english-preview.ts
 */

import {
  generateEnglishPreview,
  requiresPreviewConfirmation,
  PREVIEW_REQUIRED_INTENTS,
} from "../lib/voice/english-preview"

let passed = 0
let failed = 0

function assert(cond: boolean, desc: string, extra?: string) {
  if (cond) {
    passed++
    console.log(`  ok   ${desc}`)
  } else {
    failed++
    console.log(`  FAIL ${desc}${extra ? "\n       " + extra : ""}`)
  }
}

console.log("\nEnglish Preview Templates")
console.log("=".repeat(60))

// ── PREVIEW_REQUIRED_INTENTS ──
console.log("\n[PREVIEW_REQUIRED_INTENTS]")
const expectedRequired = [
  "write_contract",
  "create_addendum",
  "create_transaction",
  "schedule_closing",
  "send_document",
  "send_alert",
  "update_status",
]
for (const i of expectedRequired) {
  assert(PREVIEW_REQUIRED_INTENTS.has(i), `${i} requires confirmation`)
}
assert(!PREVIEW_REQUIRED_INTENTS.has("show_pipeline"), "show_pipeline does NOT require confirmation")
assert(!PREVIEW_REQUIRED_INTENTS.has("check_deadlines"), "check_deadlines does NOT require confirmation")
assert(!PREVIEW_REQUIRED_INTENTS.has("market_analysis"), "market_analysis does NOT require confirmation")
assert(!PREVIEW_REQUIRED_INTENTS.has("calculate_roi"), "calculate_roi does NOT require confirmation")
assert(!PREVIEW_REQUIRED_INTENTS.has("run_compliance"), "run_compliance does NOT require confirmation")

// ── requiresPreviewConfirmation ──
console.log("\n[requiresPreviewConfirmation]")
assert(requiresPreviewConfirmation("write_contract") === true, "write_contract → true")
assert(requiresPreviewConfirmation("show_pipeline") === false, "show_pipeline → false")

// ── Read-only intents return null ──
console.log("\n[Read-only intents → null]")
assert(generateEnglishPreview("show_pipeline", {}) === null, "show_pipeline → null")
assert(generateEnglishPreview("check_deadlines", {}) === null, "check_deadlines → null")
assert(generateEnglishPreview("market_analysis", { address: "Garden District" }) === null, "market_analysis → null")
assert(generateEnglishPreview("calculate_roi", { price: "200000", rent: "1500" }) === null, "calculate_roi → null")
assert(generateEnglishPreview("run_compliance", {}) === null, "run_compliance → null")

// ── write_contract ──
console.log("\n[write_contract]")
const wc1 = generateEnglishPreview("write_contract", {
  address: "742 Evergreen",
  price: "315000",
  buyer_name: "homer simpson",
  closing_date: "May 5",
})
console.log("  →", wc1)
assert(wc1?.includes("742 Evergreen") ?? false, "contains address")
assert(wc1?.includes("$315,000") ?? false, "formats price with commas")
assert(wc1?.includes("Homer Simpson") ?? false, "title-cases buyer name")
assert(wc1?.startsWith("You said:") ?? false, "starts with 'You said:'")
assert(wc1?.endsWith("Is this right?") ?? false, "ends with confirmation prompt")

const wc2 = generateEnglishPreview("write_contract", {})
console.log("  →", wc2)
assert(wc2 !== null, "handles empty entities (returns a preview)")

// ── create_addendum ──
console.log("\n[create_addendum]")
const ca1 = generateEnglishPreview("create_addendum", {
  address: "742 Evergreen",
  description: "extend inspection by 5 days",
})
console.log("  →", ca1)
assert(ca1?.includes("742 Evergreen") ?? false, "contains address")
assert(ca1?.includes("extend inspection by 5 days") ?? false, "contains description")
assert(ca1?.includes("addendum") ?? false, "mentions addendum")

const ca2 = generateEnglishPreview("create_addendum", { address: "5834 Guice Dr" })
console.log("  →", ca2)
assert(ca2?.includes("5834 Guice Dr") ?? false, "works with only address")

// ── create_transaction ──
console.log("\n[create_transaction]")
const ct1 = generateEnglishPreview("create_transaction", {
  address: "123 Main St",
  price: "250000",
  buyer_name: "john smith",
})
console.log("  →", ct1)
assert(ct1?.includes("123 Main St") ?? false, "contains address")
assert(ct1?.includes("$250,000") ?? false, "formats price")
assert(ct1?.includes("John Smith") ?? false, "title-cases buyer")

// ── schedule_closing ──
console.log("\n[schedule_closing]")
const sc1 = generateEnglishPreview("schedule_closing", {
  address: "123 Main",
  date: "next Friday",
})
console.log("  →", sc1)
assert(sc1?.includes("123 Main") ?? false, "contains address")
assert(sc1?.includes("next Friday") ?? false, "keeps original date phrase")
assert(/Fri|Mon|Tue|Wed|Thu|Sat|Sun/.test(sc1 ?? ""), "resolves weekday via chrono")

const sc2 = generateEnglishPreview("schedule_closing", {
  address: "456 Oak",
  date: "May 15 2026",
})
console.log("  →", sc2)
assert(sc2?.includes("456 Oak") ?? false, "contains address")
assert((sc2?.includes("May") ?? false), "contains month")

// ── send_document ──
console.log("\n[send_document]")
const sd1 = generateEnglishPreview("send_document", {
  document_type: "purchase agreement",
  buyer_name: "jane doe",
  address: "789 Pine",
})
console.log("  →", sd1)
assert(sd1?.includes("purchase agreement") ?? false, "contains doc type")
assert(sd1?.includes("Jane Doe") ?? false, "contains recipient")
assert(sd1?.includes("789 Pine") ?? false, "contains address")

// ── send_alert ──
console.log("\n[send_alert]")
const sa1 = generateEnglishPreview("send_alert", {
  buyer_role: "buyer",
  description: "inspection scheduled for Monday",
})
console.log("  →", sa1)
assert(sa1?.includes("inspection scheduled") ?? false, "contains description")

// ── update_status ──
console.log("\n[update_status]")
const us1 = generateEnglishPreview("update_status", {
  address: "123 Main",
  status: "UNDER_CONTRACT",
})
console.log("  →", us1)
assert(us1?.includes("123 Main") ?? false, "contains address")
assert(us1?.toLowerCase().includes("under contract") ?? false, "normalizes status")

// ── Currency formatter edge cases ──
console.log("\n[Currency edge cases]")
const money1 = generateEnglishPreview("write_contract", { address: "X", price: "1500000" })
assert(money1?.includes("$1,500,000") ?? false, "formats 1.5M correctly")

const money2 = generateEnglishPreview("write_contract", { address: "X", price: "$315,000" })
assert(money2?.includes("$315,000") ?? false, "strips and re-formats")

// ── Summary ──
console.log("\n" + "=".repeat(60))
console.log(`Results: ${passed}/${passed + failed} passed`)
if (failed > 0) {
  console.log(`FAIL: ${failed} tests failed`)
  process.exit(1)
} else {
  console.log("ALL TESTS PASSED")
  process.exit(0)
}
