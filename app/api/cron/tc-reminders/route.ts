import { NextRequest, NextResponse } from "next/server"
import { processAllReminders } from "@/lib/tc/notifications"

/**
 * AIRE TC — Daily Reminder Cron Job
 * Runs at 6:00 AM daily via Vercel Cron.
 * Processes deadline reminders for all PRO/INVESTOR users.
 *
 * vercel.json: { "crons": [{ "path": "/api/cron/tc-reminders", "schedule": "0 6 * * *" }] }
 */

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const startTime = Date.now()
    const batches = await processAllReminders(3) // 3 days ahead

    const totalAlerts = batches.reduce((n, b) => n + b.alertsTriggered, 0)
    const totalNotifications = batches.reduce((n, b) => n + b.notifications.length, 0)
    const duration = Date.now() - startTime

    console.log(`[TC Cron] Processed ${batches.length} users, ${totalAlerts} alerts, ${totalNotifications} notifications in ${duration}ms`)

    return NextResponse.json({
      success: true,
      usersProcessed: batches.length,
      totalAlerts,
      totalNotifications,
      durationMs: duration,
      batches: batches.map(b => ({
        userId: b.userId,
        deadlinesChecked: b.deadlinesChecked,
        alertsTriggered: b.alertsTriggered,
        notificationCount: b.notifications.length,
      })),
      ranAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[TC Cron] Failed:", error)
    return NextResponse.json({ error: "TC reminder cron failed" }, { status: 500 })
  }
}
