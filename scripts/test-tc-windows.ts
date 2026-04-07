import prisma from "../lib/prisma"
import { processAllReminders } from "../lib/tc/notifications"

async function main() {
  const user = await prisma.user.findFirst({
    where: { clerkId: "user_3BPsxwC2Ahn17KlWwzHwsYaWLJY" },
  })
  if (!user) {
    console.log("No user")
    return
  }

  const txn = await prisma.transaction.findFirst({
    where: { userId: user.id, status: { notIn: ["CLOSED", "CANCELLED"] } },
  })
  if (!txn) {
    console.log("No active txn")
    return
  }

  // Wipe any leftover synthetic deadlines from prior runs
  await prisma.deadline.deleteMany({
    where: { name: { startsWith: "TEST_WINDOW_" }, userId: user.id },
  })

  const now = new Date()
  now.setHours(12, 0, 0, 0)
  const days = [7, 3, 1, 0]
  for (const d of days) {
    const due = new Date(now.getTime() + d * 86_400_000)
    await prisma.deadline.create({
      data: {
        userId: user.id,
        transactionId: txn.id,
        name: `TEST_WINDOW_${d}day`,
        dueDate: due,
        notes: "synthetic test deadline",
      },
    })
  }
  console.log("Created 4 test deadlines at 7/3/1/0 days out")

  const batches = await processAllReminders()
  for (const b of batches) {
    console.log(
      `User ${b.userId.slice(0, 10)}: ${b.deadlinesChecked} checked, ${b.alertsTriggered} alerts triggered, ${b.notifications.length} notifications`
    )
    for (const n of b.notifications) {
      console.log(`  [${n.channel}] ${n.deadline} -> ${n.status}`)
    }
  }

  console.log("\nSecond run (idempotency check):")
  const batches2 = await processAllReminders()
  for (const b of batches2) {
    console.log(`  User ${b.userId.slice(0, 10)}: ${b.alertsTriggered} alerts (expect 0)`)
  }

  const testDls = await prisma.deadline.findMany({
    where: { name: { startsWith: "TEST_WINDOW_" } },
    orderBy: { name: "asc" },
  })
  console.log("\nAlerted windows recorded in notes field:")
  for (const dl of testDls) {
    console.log(`  ${dl.name}: notes="${dl.notes}" alertSent=${dl.alertSent}`)
  }

  await prisma.deadline.deleteMany({ where: { name: { startsWith: "TEST_WINDOW_" } } })
  console.log("\nTest deadlines cleaned up.")
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error("FAIL:", e)
  process.exit(1)
})
