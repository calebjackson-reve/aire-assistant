// app/api/cron/qa-test/route.ts
//
// QA Test Agent — runs every 6 hours.
// Full route coverage: public pages, auth-protected pages, API routes, cron routes, static assets.
// Sends SMS alert on failures via Twilio.

import { NextRequest, NextResponse } from "next/server"
import { sendSms } from "@/lib/twilio"

export const maxDuration = 120

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.aireintel.org"

interface HealthCheck {
  path: string
  name: string
  method?: "GET" | "POST"
  expectedStatus: number | number[]
  category: "public" | "auth" | "api" | "cron" | "static"
}

const CHECKS: HealthCheck[] = [
  // Public pages
  { path: "/", name: "Homepage", expectedStatus: 200, category: "public" },
  { path: "/sign-in", name: "Sign In", expectedStatus: 200, category: "public" },
  { path: "/sign-up", name: "Sign Up", expectedStatus: 200, category: "public" },
  { path: "/billing", name: "Billing", expectedStatus: 200, category: "public" },

  // Auth-protected pages (expect 307 redirect to Clerk)
  { path: "/aire", name: "Dashboard", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/transactions", name: "Transactions", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/contracts", name: "Contracts", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/morning-brief", name: "Morning Brief", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/email", name: "Email Intel", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/intelligence", name: "Intelligence", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/monitoring", name: "Monitoring", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/settings", name: "Settings", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/relationships", name: "Relationships", expectedStatus: [307, 302], category: "auth" },
  { path: "/aire/voice-analytics", name: "Voice Analytics", expectedStatus: [307, 302], category: "auth" },
  { path: "/airsign", name: "AirSign", expectedStatus: [307, 302], category: "auth" },
  { path: "/airsign/new", name: "AirSign New", expectedStatus: [307, 302], category: "auth" },

  // API routes (401 without auth = PASS, 500 = FAIL)
  { path: "/api/transactions", name: "Transactions API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/contacts", name: "Contacts API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/vendors", name: "Vendors API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/documents/list", name: "Documents API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/airsign/envelopes", name: "AirSign API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/monitoring/snapshot", name: "Monitoring API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/monitoring/metrics", name: "Metrics API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/voice-command/analytics", name: "Voice Analytics API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/feedback", name: "Feedback API", expectedStatus: [200, 401, 405], category: "api" },
  { path: "/api/data/health", name: "Data Health API", expectedStatus: 200, category: "api" },
  { path: "/api/agents/status", name: "Agents API", expectedStatus: [200, 401, 307], category: "api" },
  { path: "/api/voice-command/v2", name: "Voice V2 API", method: "POST", expectedStatus: [401, 307, 400], category: "api" },
  { path: "/api/contracts/write", name: "Contract Write API", method: "POST", expectedStatus: [401, 307, 400], category: "api" },
  { path: "/api/compliance/scan", name: "Compliance API", method: "POST", expectedStatus: [401, 307, 400], category: "api" },
  { path: "/api/documents/upload", name: "Upload API", method: "POST", expectedStatus: [401, 307, 400], category: "api" },

  // Cron routes
  { path: "/api/cron/morning-brief", name: "Morning Brief Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/deadline-alerts", name: "Deadline Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/tc-reminders", name: "TC Reminders Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/comms-scan", name: "Comms Scan Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/email-scan", name: "Email Scan Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/data-sync", name: "Data Sync Cron", expectedStatus: [200, 401], category: "cron" },
  { path: "/api/cron/learning", name: "Learning Cron", expectedStatus: [200, 401], category: "cron" },

  // Static assets
  { path: "/headshot-2.jpg", name: "Headshot Image", expectedStatus: [200, 206], category: "static" },
]

interface CheckResult {
  name: string
  path: string
  category: string
  status: number
  ok: boolean
  responseTime: number
  error?: string
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const results: CheckResult[] = []
  let failures = 0
  let warnings = 0

  // Run all checks
  for (const check of CHECKS) {
    const checkStart = Date.now()
    try {
      const res = await fetch(`${APP_URL}${check.path}`, {
        method: check.method || "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      })

      const expectedStatuses = Array.isArray(check.expectedStatus)
        ? check.expectedStatus
        : [check.expectedStatus]

      const ok = expectedStatuses.includes(res.status)
      const responseTime = Date.now() - checkStart
      const slow = responseTime > 5000

      if (!ok) failures++
      if (slow) warnings++

      results.push({
        name: check.name,
        path: check.path,
        category: check.category,
        status: res.status,
        ok: ok && !slow,
        responseTime,
        error: !ok
          ? `Expected ${JSON.stringify(check.expectedStatus)}, got ${res.status}`
          : slow
          ? `Slow response: ${responseTime}ms (threshold: 5000ms)`
          : undefined,
      })
    } catch (err) {
      failures++
      results.push({
        name: check.name,
        path: check.path,
        category: check.category,
        status: 0,
        ok: false,
        responseTime: Date.now() - checkStart,
        error: err instanceof Error ? err.message : "Request failed",
      })
    }
  }

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  // SMS alert on failures
  if (failures > 0) {
    const alertPhone = process.env.ALERT_PHONE_NUMBER
    const failSummary = failed
      .slice(0, 5)
      .map(f => `${f.name}: ${f.error}`)
      .join("\n")
    const msg = `AIRE QA: ${failures} failures\n${failSummary}`

    console.error("[QA-TEST]", msg)

    if (alertPhone) {
      await sendSms(alertPhone, msg.substring(0, 160))
    }
  }

  const summary = {
    agent: "qa-test",
    timestamp: new Date().toISOString(),
    totalChecks: results.length,
    passed,
    failed: failures,
    warnings,
    avgResponseTime: Math.round(
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    ),
    totalDuration: Date.now() - start,
    failures: failed,
    results,
  }

  console.log(
    `[QA-TEST] ${passed}/${results.length} passed, ${failures} failed, ${warnings} warnings in ${summary.totalDuration}ms`
  )

  return NextResponse.json(summary)
}
