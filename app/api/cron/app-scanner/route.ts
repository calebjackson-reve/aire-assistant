import { NextResponse } from "next/server"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aireintel.org"

// Every page and critical API route to check
const HEALTH_CHECKS = [
  // Public pages
  { path: "/", name: "Homepage", expectedStatus: 200 },
  { path: "/sign-in", name: "Sign In", expectedStatus: 200 },
  { path: "/sign-up", name: "Sign Up", expectedStatus: 200 },
  { path: "/billing", name: "Billing", expectedStatus: 200 },

  // API routes (should return 401 without auth, not 500)
  { path: "/api/transactions", name: "Transactions API", expectedStatus: [200, 401, 307] },
  { path: "/api/airsign/envelopes", name: "AirSign API", expectedStatus: [200, 401, 307] },
  { path: "/api/data/health", name: "Data Health API", expectedStatus: 200 },
  { path: "/api/monitoring/metrics", name: "Monitoring API", expectedStatus: [200, 401, 307] },
  { path: "/api/feedback", name: "Feedback API", expectedStatus: [200, 401, 405] },

  // Cron routes (should return 401 without CRON_SECRET)
  { path: "/api/cron/morning-brief", name: "Morning Brief Cron", expectedStatus: [200, 401] },
  { path: "/api/cron/deadline-alerts", name: "Deadline Cron", expectedStatus: [200, 401] },
]

interface CheckResult {
  name: string
  path: string
  status: number
  ok: boolean
  responseTime: number
  error?: string
}

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: CheckResult[] = []
  let failures = 0

  for (const check of HEALTH_CHECKS) {
    const start = Date.now()
    try {
      const res = await fetch(`${APP_URL}${check.path}`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      })

      const expectedStatuses = Array.isArray(check.expectedStatus)
        ? check.expectedStatus
        : [check.expectedStatus]

      const ok = expectedStatuses.includes(res.status)
      if (!ok) failures++

      results.push({
        name: check.name,
        path: check.path,
        status: res.status,
        ok,
        responseTime: Date.now() - start,
        error: ok ? undefined : `Expected ${check.expectedStatus}, got ${res.status}`,
      })
    } catch (err) {
      failures++
      results.push({
        name: check.name,
        path: check.path,
        status: 0,
        ok: false,
        responseTime: Date.now() - start,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }
  }

  // If failures, send alert
  if (failures > 0) {
    const failedChecks = results.filter(r => !r.ok)
    const alertMsg = `AIRE Scanner: ${failures} failures detected\n${failedChecks.map(f => `${f.name}: ${f.error}`).join("\n")}`

    // Log to console (Vercel logs)
    console.error("[APP-SCANNER]", alertMsg)

    // SMS alert logged — would need twilio package for real SMS
    if (process.env.ALERT_PHONE_NUMBER) {
      console.log("[APP-SCANNER] Would SMS alert to:", process.env.ALERT_PHONE_NUMBER, alertMsg.substring(0, 160))
    }
  }

  // Store results for dashboard
  const summary = {
    timestamp: new Date().toISOString(),
    totalChecks: results.length,
    passed: results.filter(r => r.ok).length,
    failed: failures,
    avgResponseTime: Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length),
    results,
  }

  return NextResponse.json(summary)
}
