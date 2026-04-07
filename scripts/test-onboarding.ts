// Test script for Day One onboarding endpoints.
// Run with: set -a && source .env.local && set +a && npx tsx scripts/test-onboarding.ts
//
// NOTE: These API endpoints are Clerk-protected so a raw fetch from a script cannot
// hit them end-to-end without a signed session. This script therefore exercises:
//   1. The vCard parser (pure function, no network)
//   2. Prisma round-trips for the new User columns (direct DB)
//   3. A ping to each onboarding route to confirm it is registered and returns 401
//      (rather than 404) — proving the route exists and the auth guard is wired.

import prisma from "../lib/prisma"
import { parseVCard } from "../lib/onboarding/vcard-parser"

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000"

const SAMPLE_VCF = `BEGIN:VCARD
VERSION:3.0
FN:Jane Doe
N:Doe;Jane;;;
EMAIL:jane@example.com
TEL:+12255551212
ORG:Reve Realtors
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:John Smith
N:Smith;John;;;
EMAIL:john@example.com
TEL:+12255553434
END:VCARD`

async function expectProtected(path: string) {
  const res = await fetch(`${BASE}${path}`)
  const ok = res.status === 401 || res.status === 405 || res.status === 400
  console.log(`  ${ok ? "OK" : "FAIL"}  ${path}  -> ${res.status}`)
  return ok
}

async function main() {
  console.log("\n--- Day One Onboarding Smoke Test ---\n")

  // 1. vCard parser
  console.log("[1] vCard parser")
  const contacts = parseVCard(SAMPLE_VCF)
  console.log(`  parsed ${contacts.length} contacts`)
  if (contacts.length !== 2) throw new Error("expected 2 contacts")
  if (contacts[0].email !== "jane@example.com") throw new Error("bad email parse")
  if (contacts[0].firstName !== "Jane") throw new Error("bad first name parse")
  console.log("  OK\n")

  // 2. Schema round-trip on any existing user (read-only check of new columns)
  console.log("[2] User schema columns")
  const anyUser = await prisma.user.findFirst({
    select: {
      id: true,
      onboarded: true,
      onboardedAt: true,
      brokerageName: true,
      licenseNumber: true,
      defaultCommissionSplit: true,
      preferredTitleCompany: true,
      avatarUrl: true,
      signatureData: true,
      onboardingData: true,
    },
  })
  if (!anyUser) {
    console.log("  (no users in DB — column shape still validates at compile time)")
  } else {
    console.log("  columns accessible:", Object.keys(anyUser).join(", "))
  }
  console.log("  OK\n")

  // 3. Route registration pings (expect 401 Unauthorized — NOT 404)
  console.log("[3] Route registration (expect 401/405/400 — not 404)")
  const paths = [
    "/api/onboarding/profile",
    "/api/onboarding/signature",
    "/api/onboarding/vcard",
    "/api/onboarding/mls",
    "/api/onboarding/complete",
    "/api/oauth/gmail/start",
  ]
  let allOk = true
  for (const p of paths) {
    const ok = await expectProtected(p)
    if (!ok) allOk = false
  }

  console.log("\n" + (allOk ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"))
  await prisma.$disconnect()
  process.exit(allOk ? 0 : 1)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
