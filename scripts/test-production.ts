/**
 * AIRE Production Endpoint Test Suite
 *
 * Hits every API route on the deployed app to verify they respond correctly.
 * Runs N iterations to confirm stability. Exits 0 only if ALL pass ALL runs.
 *
 * Usage:
 *   npx tsx scripts/test-production.ts https://aireintel.org 10
 *   npx tsx scripts/test-production.ts http://localhost:3000 5
 */

const BASE_URL = process.argv[2] || "https://aireintel.org"
const ITERATIONS = parseInt(process.argv[3] || "10", 10)

interface TestResult {
  name: string
  method: string
  path: string
  status: number
  ok: boolean
  ms: number
  error?: string
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  expectStatus?: number[]
): Promise<TestResult> {
  const url = `${BASE_URL}${path}`
  const start = Date.now()
  const acceptable = expectStatus || [200, 401, 403] // 401/403 = auth working correctly

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // No auth header — we expect 401 for protected routes (that's correct behavior)
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const ms = Date.now() - start
    const ok = acceptable.includes(res.status)

    return { name, method, path, status: res.status, ok, ms }
  } catch (err) {
    const ms = Date.now() - start
    return {
      name,
      method,
      path,
      status: 0,
      ok: false,
      ms,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── TEST DEFINITIONS ───────────────────────────────────────────

const TESTS: { name: string; method: string; path: string; body?: Record<string, unknown>; expect?: number[] }[] = [
  // Public pages (should return 200)
  { name: "Homepage", method: "GET", path: "/", expect: [200] },
  { name: "Sign-in page", method: "GET", path: "/sign-in", expect: [200, 307, 308] },

  // Auth-protected pages (should redirect or return 200/307)
  { name: "Dashboard", method: "GET", path: "/aire", expect: [200, 307, 308] },
  { name: "Transactions", method: "GET", path: "/aire/transactions", expect: [200, 307, 308] },
  { name: "Contracts", method: "GET", path: "/aire/contracts", expect: [200, 307, 308] },
  { name: "Morning Brief", method: "GET", path: "/aire/morning-brief", expect: [200, 307, 308] },
  { name: "Email", method: "GET", path: "/aire/email", expect: [200, 307, 308] },
  { name: "Intelligence", method: "GET", path: "/aire/intelligence", expect: [200, 307, 308] },
  { name: "Monitoring", method: "GET", path: "/aire/monitoring", expect: [200, 307, 308] },
  { name: "Settings", method: "GET", path: "/aire/settings", expect: [200, 307, 308] },
  { name: "Transcript Tasks", method: "GET", path: "/aire/transcript-tasks", expect: [200, 307, 308] },
  { name: "AirSign Dashboard", method: "GET", path: "/airsign", expect: [200, 307, 308] },

  // API routes — protected (expect 401 without auth = correct)
  { name: "API: Transactions", method: "GET", path: "/api/transactions", expect: [200, 401, 403] },
  { name: "API: Contacts", method: "GET", path: "/api/contacts", expect: [200, 401, 403] },
  { name: "API: Vendors", method: "GET", path: "/api/vendors", expect: [200, 401, 403] },
  { name: "API: Documents List", method: "GET", path: "/api/documents/list", expect: [200, 401, 403] },
  { name: "API: AirSign Envelopes", method: "GET", path: "/api/airsign/envelopes", expect: [200, 401, 403] },
  { name: "API: Monitoring Snapshot", method: "GET", path: "/api/monitoring/snapshot", expect: [200, 401, 403] },
  { name: "API: Monitoring Metrics", method: "GET", path: "/api/monitoring/metrics", expect: [200, 401, 403] },
  { name: "API: Voice Analytics", method: "GET", path: "/api/voice-command/analytics", expect: [200, 401, 403] },
  { name: "API: Feedback", method: "GET", path: "/api/feedback", expect: [200, 401, 403] },
  { name: "API: Learning Errors", method: "GET", path: "/api/learning/errors", expect: [200, 401, 403] },
  { name: "API: Data Health", method: "GET", path: "/api/data/health", expect: [200, 401, 403] },
  { name: "API: Data Admin", method: "GET", path: "/api/data/admin", expect: [200, 401, 403] },
  { name: "API: MLS Fields", method: "GET", path: "/api/mls/fields", expect: [200, 401, 403] },
  { name: "API: Agent Status", method: "GET", path: "/api/agents/status", expect: [200, 401, 403] },
  { name: "API: Content Schedule", method: "GET", path: "/api/content/schedule", expect: [200, 401, 403] },

  // POST routes — expect 401 (auth) or 400 (missing body) = correct
  { name: "API: Transcript Tasks POST", method: "POST", path: "/api/transcript/tasks", body: {}, expect: [400, 401, 403] },
  { name: "API: CMA POST", method: "POST", path: "/api/cma", body: {}, expect: [400, 401, 403] },
  { name: "API: Pre-Listing POST", method: "POST", path: "/api/pre-listing", body: {}, expect: [400, 401, 403] },
  { name: "API: MLS Upload POST", method: "POST", path: "/api/mls/upload", body: {}, expect: [400, 401, 403] },
  { name: "API: Compliance Scan POST", method: "POST", path: "/api/compliance/scan", body: {}, expect: [400, 401, 403] },
  { name: "API: Voice Command POST", method: "POST", path: "/api/voice-command/v2", body: {}, expect: [400, 401, 403] },
  { name: "API: Contract Write POST", method: "POST", path: "/api/contracts/write", body: {}, expect: [400, 401, 403] },
  { name: "API: Document Upload POST", method: "POST", path: "/api/documents/upload", body: {}, expect: [400, 401, 403, 500] },
  { name: "API: Email Triage GET", method: "GET", path: "/api/email/triage", expect: [200, 401, 403] },
  { name: "API: Content Campaign POST", method: "POST", path: "/api/content/campaign", body: {}, expect: [400, 401, 403] },
  { name: "API: Content Schedule POST", method: "POST", path: "/api/content/schedule", body: {}, expect: [400, 401, 403] },

  // Cron routes (expect 401 without CRON_SECRET = correct)
  { name: "Cron: Morning Brief", method: "GET", path: "/api/cron/morning-brief", expect: [200, 401] },
  { name: "Cron: Deadline Alerts", method: "GET", path: "/api/cron/deadline-alerts", expect: [200, 401] },
  { name: "Cron: TC Reminders", method: "GET", path: "/api/cron/tc-reminders", expect: [200, 401] },
  { name: "Cron: Comms Scan", method: "GET", path: "/api/cron/comms-scan", expect: [200, 401] },
  { name: "Cron: Email Scan", method: "GET", path: "/api/cron/email-scan", expect: [200, 401] },
  { name: "Cron: Data Sync", method: "GET", path: "/api/cron/data-sync", expect: [200, 401] },
  { name: "Cron: Learning", method: "GET", path: "/api/cron/learning", expect: [200, 401] },

  // Webhooks (expect specific responses)
  { name: "Webhook: Stripe", method: "POST", path: "/api/webhooks/stripe", body: {}, expect: [400, 401, 405] },
  { name: "Webhook: AirSign", method: "POST", path: "/api/airsign/webhook", body: {}, expect: [400, 401, 403] },
]

// ─── RUNNER ─────────────────────────────────────────────────────

async function runIteration(iteration: number): Promise<{ passed: number; failed: number; failures: TestResult[] }> {
  const results: TestResult[] = []

  // Run tests in batches of 5 to avoid overwhelming the server
  for (let i = 0; i < TESTS.length; i += 5) {
    const batch = TESTS.slice(i, i + 5)
    const batchResults = await Promise.all(
      batch.map((t) => testEndpoint(t.name, t.method, t.path, t.body, t.expect))
    )
    results.push(...batchResults)
  }

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const failures = results.filter((r) => !r.ok)

  return { passed, failed, failures }
}

async function main() {
  console.log("\n" + "=".repeat(70))
  console.log("AIRE PRODUCTION TEST SUITE")
  console.log("=".repeat(70))
  console.log(`Target: ${BASE_URL}`)
  console.log(`Tests:  ${TESTS.length} endpoints`)
  console.log(`Runs:   ${ITERATIONS}x`)
  console.log(`Date:   ${new Date().toISOString()}`)
  console.log("=".repeat(70) + "\n")

  let totalPassed = 0
  let totalFailed = 0
  const allFailures: { iteration: number; failures: TestResult[] }[] = []

  for (let i = 1; i <= ITERATIONS; i++) {
    process.stdout.write(`Run ${i}/${ITERATIONS}... `)
    const { passed, failed, failures } = await runIteration(i)
    totalPassed += passed
    totalFailed += failed

    if (failed > 0) {
      console.log(`${passed}/${TESTS.length} PASS, ${failed} FAIL`)
      allFailures.push({ iteration: i, failures })
    } else {
      console.log(`${passed}/${TESTS.length} ALL PASS`)
    }

    // Small delay between iterations
    if (i < ITERATIONS) await new Promise((r) => setTimeout(r, 1000))
  }

  // ─── FINAL REPORT ────────────────────────────────────────────
  console.log("\n" + "=".repeat(70))
  console.log("FINAL REPORT")
  console.log("=".repeat(70))
  console.log(`Total tests:  ${TESTS.length * ITERATIONS}`)
  console.log(`Total PASS:   ${totalPassed}`)
  console.log(`Total FAIL:   ${totalFailed}`)
  console.log(`Pass rate:    ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`)

  if (allFailures.length > 0) {
    console.log("\n--- FAILURES ---")
    for (const { iteration, failures } of allFailures) {
      console.log(`\nRun ${iteration}:`)
      for (const f of failures) {
        console.log(`  [FAIL] ${f.name} (${f.method} ${f.path})`)
        console.log(`         Status: ${f.status}${f.error ? ` Error: ${f.error}` : ""} (${f.ms}ms)`)
      }
    }
  }

  // Unique failures across all runs
  const uniqueFailures = new Map<string, { count: number; statuses: number[] }>()
  for (const { failures } of allFailures) {
    for (const f of failures) {
      const key = `${f.method} ${f.path}`
      const existing = uniqueFailures.get(key) || { count: 0, statuses: [] }
      existing.count++
      if (!existing.statuses.includes(f.status)) existing.statuses.push(f.status)
      uniqueFailures.set(key, existing)
    }
  }

  if (uniqueFailures.size > 0) {
    console.log("\n--- UNIQUE FAILING ENDPOINTS ---")
    for (const [endpoint, { count, statuses }] of uniqueFailures) {
      console.log(`  ${endpoint} — failed ${count}/${ITERATIONS} runs, statuses: [${statuses.join(",")}]`)
    }
  }

  const perfect = totalFailed === 0
  console.log("\n" + "=".repeat(70))
  console.log(perfect ? "RESULT: PERFECT — 100% pass rate across all iterations" : "RESULT: FAILURES DETECTED — see above")
  console.log("=".repeat(70) + "\n")

  process.exit(perfect ? 0 : 1)
}

main().catch((e) => {
  console.error("Test runner crashed:", e)
  process.exit(2)
})
