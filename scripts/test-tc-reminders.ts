/**
 * Smoke test for TC deadline reminder cron logic.
 * Exercises processAllReminders() against the live DB + the new 7/3/1/0 window logic.
 * Console-logs results since RESEND_API_KEY fallback is active when not configured.
 */
import { processAllReminders } from "../lib/tc/notifications"

async function main() {
  console.log("Running processAllReminders()...\n")
  const batches = await processAllReminders()
  console.log(`Batches processed: ${batches.length}`)
  for (const b of batches) {
    console.log(
      `  User ${b.userId.slice(0, 10)}: ${b.deadlinesChecked} deadlines checked, ` +
        `${b.alertsTriggered} alerts triggered, ${b.notifications.length} notifications`
    )
    for (const n of b.notifications) {
      console.log(`    [${n.channel}] ${n.deadline} @ ${n.propertyAddress} -> ${n.status}`)
    }
  }
  console.log("\nDone.")
}

main().catch((e) => {
  console.error("FAIL:", e)
  process.exit(1)
})
