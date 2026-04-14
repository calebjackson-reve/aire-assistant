/**
 * AIRESIGN v2 unit/integration smoke harness.
 *
 *   npx tsx scripts/test-airsign-v2.ts
 *
 * Covers:
 *   1. Loop Data Model — data-keys vocabulary + resolve + deepMerge
 *   2. Template scope resolution shape (no DB writes)
 *   3. Dotloop import normalizer (in-memory, no DB)
 *   4. Bulk-send CSV parser
 *   5. Signer-auth helpers (hash, generate, constantTimeEq)
 *
 * No DB writes. Safe to run anywhere.
 * For a full flow regression including the legacy AirSign system, run the
 * existing scripts/test-airsign-flow.ts harness afterward — it must still pass 7/7.
 */

import {
  DATA_KEYS,
  DATA_KEY_MAP,
  isValidDataKey,
  resolveDataKey,
  loopDataFromTransaction,
  deepMergeLoopData,
} from "../lib/airsign/v2/data-keys"
import { normalizeDotloopExport } from "../lib/airsign/v2/loop-autofill"
import { parseCsvRows } from "../lib/airsign/v2/bulk-send"
import {
  generateOtp,
  generateAccessCode,
  hashSecret,
  constantTimeEq,
} from "../lib/airsign/v2/signer-auth"

let pass = 0
let fail = 0

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function group(title: string) {
  console.log(`\n${title}`)
}

// ── 1. Data-keys vocabulary ──
group("1. Loop Data Model vocabulary")
ok("DATA_KEYS includes property.streetName", isValidDataKey("loop.property.streetName"))
ok("DATA_KEYS includes financials.salePrice", isValidDataKey("loop.financials.salePrice"))
ok("DATA_KEYS includes buyer[0].name", isValidDataKey("loop.buyer[0].name"))
ok("DATA_KEYS map has 60+ keys", DATA_KEYS.length >= 60, `count=${DATA_KEYS.length}`)
ok("Unknown key rejected", !isValidDataKey("loop.foo.bar"))
ok("DATA_KEY_MAP covers every entry", DATA_KEYS.every((d) => DATA_KEY_MAP[d.key]?.key === d.key))

// ── 2. resolveDataKey + deepMerge ──
group("2. resolveDataKey + deepMerge")
const sampleLoop = {
  loop: {
    property: { streetNumber: "554", streetName: "Avenue F", city: "Port Allen" },
    financials: { salePrice: 210000 },
    buyer: [{ name: "Gavin Shaw" }],
  },
}
ok("resolves nested string", resolveDataKey(sampleLoop, "loop.property.streetName") === "Avenue F")
ok("resolves number", resolveDataKey(sampleLoop, "loop.financials.salePrice") === 210000)
ok("resolves array element", resolveDataKey(sampleLoop, "loop.buyer[0].name") === "Gavin Shaw")
ok("missing returns undefined", resolveDataKey(sampleLoop, "loop.lender.company") === undefined)
const merged = deepMergeLoopData(sampleLoop, { loop: { property: { unit: "B" } } } as Record<string, unknown>)
ok("deepMerge preserves existing", resolveDataKey(merged, "loop.property.streetName") === "Avenue F")
ok("deepMerge adds new field", resolveDataKey(merged, "loop.property.unit") === "B")

// ── 3. loopDataFromTransaction seed ──
group("3. loopDataFromTransaction seed")
const txnSeed = loopDataFromTransaction({
  propertyAddress: "554 Avenue F",
  propertyCity: "Port Allen",
  propertyState: "LA",
  propertyZip: "70767",
  acceptedPrice: 210000,
  buyerName: "Gavin Shaw",
  buyerEmail: "g@example.com",
})
ok("seed splits street number", resolveDataKey(txnSeed, "loop.property.streetNumber") === "554")
ok("seed extracts street name", resolveDataKey(txnSeed, "loop.property.streetName") === "Avenue F")
ok("seed sets sale price", resolveDataKey(txnSeed, "loop.financials.salePrice") === 210000)
ok("seed creates buyer entry", resolveDataKey(txnSeed, "loop.buyer[0].name") === "Gavin Shaw")

// ── 4. Dotloop normalizer ──
group("4. Dotloop normalizer")
const dotloop = {
  loop: {
    id: 316302400,
    name: "554 Avenue F",
    address: "554 Avenue F",
    participants: [
      { fullName: "Gavin Shaw", email: "g@example.com", role: "BUYER" },
      { fullName: "Rima Hodgeson", email: "rima@compass.com", role: "LISTING_AGENT" },
    ],
    fields: { city: "Port Allen", state: "LA", zip: "70767", salePrice: "210000" },
    documents: [{ id: 1, name: "Purchase Agreement.pdf", url: "https://example.com/pa.pdf" }],
  },
}
const parsed = normalizeDotloopExport(dotloop)
ok("normalizer extracts street", resolveDataKey(parsed, "loop.property.streetNumber") === "554")
ok("normalizer extracts buyer", resolveDataKey(parsed, "loop.buyer[0].name") === "Gavin Shaw")
ok("normalizer extracts listing agent", resolveDataKey(parsed, "loop.listingAgent.name") === "Rima Hodgeson")
ok("normalizer parses currency string", resolveDataKey(parsed, "loop.financials.salePrice") === 210000)

// ── 5. Bulk-send CSV parser ──
group("5. Bulk-send CSV parser")
const csv =
  "envelope_name,signer_name,signer_email,signer_phone,signer_role,permission,auth_method\n" +
  "Disclosure - 123 Main,John Buyer,john@example.com,+12255550101,BUYER,CAN_SIGN,EMAIL_LINK\n" +
  "Disclosure - 123 Main,Jane Buyer,jane@example.com,+12255550102,BUYER,CAN_SIGN,EMAIL_LINK\n" +
  "Disclosure - 456 Oak,Joe Seller,joe@example.com,+12255550103,SELLER,CAN_SIGN,SMS_OTP\n"
const rows = parseCsvRows(csv)
ok("groups same envelope_name", rows.length === 2, `got ${rows.length}`)
ok("first envelope has 2 signers", rows[0]?.signers.length === 2)
ok("second envelope has 1 signer", rows[1]?.signers.length === 1)
ok("preserves auth method", rows[1]?.signers[0]?.authMethod === "SMS_OTP")
try {
  parseCsvRows("foo,bar\nbaz,qux")
  ok("rejects CSV without required columns", false, "expected throw")
} catch {
  ok("rejects CSV without required columns", true)
}

// ── 6. Signer-auth crypto ──
group("6. Signer-auth crypto helpers")
const otpA = generateOtp()
const otpB = generateOtp()
ok("OTP is 6-digit", /^\d{6}$/.test(otpA))
ok("OTPs differ", otpA !== otpB)
const code = generateAccessCode()
ok("Access code is 8 chars", code.length === 8)
ok("Access code uses safe alphabet", /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(code))
ok("hashSecret is deterministic", hashSecret("hello") === hashSecret("hello"))
ok("hashSecret differs by input", hashSecret("a") !== hashSecret("b"))
ok("constantTimeEq matches equal hashes", constantTimeEq(hashSecret("x"), hashSecret("x")))
ok("constantTimeEq rejects unequal hashes", !constantTimeEq(hashSecret("x"), hashSecret("y")))

// ── Summary ──
console.log(`\n${"=".repeat(40)}`)
console.log(`Result: ${pass} passed · ${fail} failed`)
if (fail > 0) {
  process.exit(1)
}
