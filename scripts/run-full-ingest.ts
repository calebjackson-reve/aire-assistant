/**
 * Fire the full 45-day Gmail ingest for Caleb.
 * Prerequisites: EmailAccount row must exist (user completed OAuth).
 *
 * Usage: set env, then `npx tsx scripts/run-full-ingest.ts`
 */
import prisma from "../lib/prisma"
import { runFullIngest } from "../lib/onboarding/full-ingest"

async function main() {
  const user = await prisma.user.findFirst({
    where: { clerkId: "user_3BPsxwC2Ahn17KlWwzHwsYaWLJY" },
  })
  if (!user) {
    console.error("User not found")
    process.exit(1)
  }

  const account = await prisma.emailAccount.findFirst({
    where: { userId: user.id, provider: "gmail", isActive: true },
  })
  if (!account) {
    console.error(
      "\n❌ No active Gmail account.\n   Complete OAuth at http://localhost:3000/onboarding first.\n"
    )
    process.exit(1)
  }

  console.log(`\n✅ Found Gmail account: ${account.email}`)
  console.log(`   Last scan: ${account.lastScan?.toISOString() || "never"}\n`)
  console.log(`Starting 45-day full ingest...\n`)

  const result = await runFullIngest(user.id)

  console.log("\n═════════════════════════════════")
  console.log("  INGEST COMPLETE")
  console.log("═════════════════════════════════")
  console.log(`  Emails scanned:        ${result.emailsScanned}`)
  console.log(`  Attachments found:     ${result.attachmentsFound}`)
  console.log(`  Documents created:     ${result.documentsCreated}`)
  console.log(`  Contacts created:      ${result.contactsCreated}`)
  console.log(`  Voice profile:         ${result.voiceProfileExtracted ? "extracted ✅" : "skipped"}`)
  console.log(`  Duration:              ${(result.durationMs / 1000).toFixed(1)}s`)
  if (result.errors.length > 0) {
    console.log(`  Errors:`)
    result.errors.forEach((e) => console.log(`    - ${e}`))
  }
  console.log("═════════════════════════════════\n")

  // Quick audit query
  const [txnCount, contactCount, docCount] = await Promise.all([
    prisma.transaction.count({ where: { userId: user.id } }),
    prisma.contact.count({ where: { agentId: user.id } }),
    prisma.document.count({ where: { transaction: { userId: user.id } } }),
  ])
  console.log(`Current DB state for user:`)
  console.log(`  Transactions: ${txnCount}`)
  console.log(`  Contacts:     ${contactCount}`)
  console.log(`  Documents:    ${docCount}\n`)

  // Voice profile preview
  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    select: { voiceProfile: true },
  })
  if (updated?.voiceProfile) {
    console.log(`Voice profile extracted:`)
    console.log(JSON.stringify(updated.voiceProfile, null, 2))
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("FAIL:", e)
  process.exit(1)
})
