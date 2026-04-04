// scripts/test-route.ts
// AIRE Route Mode — tests the REAL /api/tc/voice endpoint with a live Clerk token.
//
// Run with: npx tsx scripts/test-route.ts --input "your voice command here"
//
// Setup (one time):
//   1. Start dev server: npm run dev
//   2. Sign in to aireintel.org/sign-in in your browser
//   3. Open DevTools → Application → Cookies → find "__session" cookie value
//      OR: DevTools → Console → type: document.cookie
//      OR: DevTools → Network → any /api request → Headers → Cookie: __session=...
//   4. Copy that token value into .env.test:
//        AIRE_TEST_SESSION_TOKEN=eyJhbGci...
//        AIRE_TEST_BASE_URL=http://localhost:3000
//   5. Run: npx tsx scripts/test-route.ts --input "inspection deadline on Seyburn"

import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"
import {
  printBanner,
  printResult,
  printUsage,
  assertPresent,
  assertOneOf,
  type HarnessResult,
} from "./harness-output"

// ─── LOAD .env.test ───────────────────────────────────────────────────────────

function loadEnvTest(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.test")

  if (!fs.existsSync(envPath)) {
    return {}
  }

  const raw = fs.readFileSync(envPath, "utf-8")
  const result: Record<string, string> = {}

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "")
    result[key] = val
  }

  return result
}

// ─── PARSE CLI ARGS ───────────────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2)
      const val =
        args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true"
      parsed[key] = val
      if (val !== "true") i++
    }
  }
  return parsed
}

// ─── TOKEN FRESHNESS CHECK ────────────────────────────────────────────────────
// Clerk JWTs expire in ~1 hour. Warn the user if the token looks stale.

function checkTokenFreshness(token: string): string | null {
  try {
    // JWT is base64url encoded — decode the payload (middle segment)
    const parts = token.split(".")
    if (parts.length !== 3) return "Token does not look like a valid JWT (expected 3 parts)"

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    )

    const exp = payload.exp as number | undefined
    if (!exp) return null // no expiry claim — can't check

    const nowSec = Math.floor(Date.now() / 1000)
    const secondsRemaining = exp - nowSec

    if (secondsRemaining <= 0) {
      const expiredMinsAgo = Math.abs(Math.round(secondsRemaining / 60))
      return `Token expired ${expiredMinsAgo} minute(s) ago. Grab a fresh one from DevTools.`
    }

    if (secondsRemaining < 300) {
      const minsLeft = Math.round(secondsRemaining / 60)
      return `Token expires in ${minsLeft} minute(s) — consider refreshing soon.`
    }

    return null // all good
  } catch {
    return null // can't decode — skip the check, let the request fail naturally
  }
}

// ─── PRINT SETUP GUIDE ────────────────────────────────────────────────────────

function printSetupGuide(): void {
  console.log("\x1b[33m")
  console.log("  ┌─────────────────────────────────────────────────────────┐")
  console.log("  │  ROUTE MODE SETUP — one time                            │")
  console.log("  └─────────────────────────────────────────────────────────┘")
  console.log("\x1b[0m")
  console.log("  Step 1: Start your dev server")
  console.log("          \x1b[36mnpm run dev\x1b[0m")
  console.log("")
  console.log("  Step 2: Sign in at http://localhost:3000/sign-in")
  console.log("")
  console.log("  Step 3: Get your session token from DevTools")
  console.log("          → Open DevTools (F12)")
  console.log("          → Network tab → click any /api/ request")
  console.log("          → Headers → Request Headers → Cookie")
  console.log("          → Copy the value of \x1b[33m__session\x1b[0m")
  console.log("          OR: Console tab → type \x1b[36mdocument.cookie\x1b[0m → copy __session value")
  console.log("")
  console.log("  Step 4: Create \x1b[36m.env.test\x1b[0m in your project root:")
  console.log("          \x1b[2m# .env.test — DO NOT COMMIT THIS FILE\x1b[0m")
  console.log("          \x1b[33mAIRE_TEST_SESSION_TOKEN\x1b[0m=eyJhbGci...")
  console.log("          \x1b[33mAIRE_TEST_BASE_URL\x1b[0m=http://localhost:3000")
  console.log("")
  console.log("  Step 5: Add .env.test to your .gitignore:")
  console.log("          \x1b[36mecho '.env.test' >> .gitignore\x1b[0m")
  console.log("")
  console.log("  Step 6: Run the harness:")
  console.log(
    '          \x1b[36mnpx tsx scripts/test-route.ts --input "inspection deadline on Seyburn"\x1b[0m'
  )
  console.log("")
  console.log("  \x1b[2mNote: Clerk tokens expire in ~1 hour. If you get 401 errors, grab a fresh token.\x1b[0m")
  console.log("")
}

// ─── VALIDATE VOICE ROUTE RESPONSE ───────────────────────────────────────────
// Based on the exact response shape documented in aire-voice-audit/SKILL.md

function validateVoiceRouteResponse(
  body: Record<string, unknown>,
  failures: string[],
  warnings: string[]
): void {
  const VALID_INTENTS = [
    "draft_addendum", "draft_counter", "draft_repair_request", "route_doc",
    "schedule_vendor", "deadline_check", "deal_summary", "cma_request",
    "lead_info", "content_gen", "deal_analysis", "other",
  ]
  const VALID_STATUSES = ["success", "ambiguous", "error"]

  // Top-level status
  assertPresent(body.status, "status", failures)
  assertOneOf(body.status, VALID_STATUSES, "status", failures)

  if (body.status === "ambiguous") {
    // Ambiguous response — different shape
    assertPresent(body.ambiguousMatches, "ambiguousMatches", failures)
    if (Array.isArray(body.ambiguousMatches) && body.ambiguousMatches.length === 0) {
      failures.push("status is 'ambiguous' but ambiguousMatches array is empty")
    }
    return
  }

  if (body.status === "error") {
    warnings.push(`Route returned error status: ${body.error || "no error message"}`)
    return
  }

  // Success response shape
  assertPresent(body.commandId, "commandId", failures)
  assertPresent(body.intent, "intent", failures)
  assertOneOf(body.intent, VALID_INTENTS, "intent", failures)
  assertPresent(body.processingMs, "processingMs", failures)

  // Patent audit trail check — commandId must be a cuid
  const cmdId = String(body.commandId || "")
  if (cmdId.length < 10) {
    failures.push(
      `commandId "${cmdId}" looks invalid — VoiceCommand may not have been logged to DB`
    )
  }

  // requiresApproval must be present (boolean)
  if (body.requiresApproval === undefined || body.requiresApproval === null) {
    failures.push("requiresApproval is missing — approval gate cannot be enforced")
  }

  // For write intents, requiresApproval MUST be true
  const writeIntents = ["draft_addendum", "draft_counter", "draft_repair_request", "route_doc", "schedule_vendor"]
  if (writeIntents.includes(String(body.intent)) && body.requiresApproval === false) {
    failures.push(
      `intent "${body.intent}" is a write action but requiresApproval is false — ` +
      "this violates the 5 Hard Walls (no client action without approval)"
    )
  }

  // For read intents, previewContent is optional but actionResult should exist
  const readIntents = ["deal_summary", "deadline_check"]
  if (readIntents.includes(String(body.intent))) {
    assertPresent(body.actionResult, "actionResult", failures)
  }

  // processingMs target check
  const ms = Number(body.processingMs)
  if (ms > 8000) {
    warnings.push(
      `processingMs = ${ms}ms exceeds the 8-second voice pipeline target. ` +
      "Check Claude API latency and DB query time."
    )
  }

  // Confidence check
  const conf = Number(body.confidence)
  if (!isNaN(conf) && conf < 0.7) {
    warnings.push(
      `confidence = ${conf} is below 0.7 threshold — transaction match may be unreliable`
    )
  }
}

// ─── PRINT ROUTE DIAGNOSTICS ──────────────────────────────────────────────────

function printRouteDiagnostics(
  statusCode: number,
  body: unknown,
  requestMs: number
): void {
  const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`
  const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`
  const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
  const CYAN   = (s: string) => `\x1b[36m${s}\x1b[0m`
  const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`

  console.log("")
  console.log(BOLD("HTTP RESPONSE"))
  console.log("─".repeat(60))

  const statusLabel = statusCode >= 200 && statusCode < 300
    ? GREEN(`${statusCode} OK`)
    : statusCode === 401
    ? RED(`${statusCode} Unauthorized — token expired or invalid`)
    : statusCode === 404
    ? RED(`${statusCode} Not Found — route may not exist or agent not in DB`)
    : statusCode === 422
    ? YELLOW(`${statusCode} Unprocessable — Claude could not parse the command`)
    : statusCode === 500
    ? RED(`${statusCode} Internal Server Error — check terminal/Vercel logs`)
    : RED(`${statusCode} Unexpected`)

  console.log(`  Status:       ${statusLabel}`)
  console.log(`  Round-trip:   ${requestMs}ms \x1b[2m(harness → route → harness)\x1b[0m`)

  // Specific guidance per status code
  if (statusCode === 401) {
    console.log("")
    console.log(RED("  ── Token Fix ──────────────────────────────────────────"))
    console.log(RED("  Your Clerk session token is expired or invalid."))
    console.log(RED("  1. Go to localhost:3000 in your browser"))
    console.log(RED("  2. Make sure you are signed in"))
    console.log(RED("  3. DevTools → Network → any /api/ request → Cookie header"))
    console.log(RED("  4. Copy the __session value and update .env.test"))
  }

  if (statusCode === 404) {
    console.log("")
    console.log(YELLOW("  ── Possible causes ────────────────────────────────────"))
    console.log(YELLOW("  • Route at /api/tc/voice does not exist yet"))
    console.log(YELLOW("  • Your agent record is not in the Neon DB"))
    console.log(YELLOW("  • Run: grep -r 'tc/voice' app/api/ to verify route exists"))
  }

  if (statusCode === 500) {
    console.log("")
    console.log(RED("  ── Common causes ──────────────────────────────────────"))
    console.log(RED("  • prisma.user instead of prisma.agent (ERR from voice audit)"))
    console.log(RED("  • userId used as agentId FK (schema mismatch)"))
    console.log(RED("  • Missing ANTHROPIC_API_KEY in .env.local"))
    console.log(RED("  • Check your terminal (npm run dev) for the stack trace"))
  }

  console.log("")

  // Show pipeline timing if available
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>
    if (b.processingMs) {
      const routeMs = Number(b.processingMs)
      const overhead = requestMs - routeMs
      console.log(BOLD("TIMING BREAKDOWN"))
      console.log("─".repeat(60))
      console.log(`  Route processing:  ${routeMs}ms \x1b[2m(reported by /api/tc/voice)\x1b[0m`)
      console.log(`  Network overhead:  ~${overhead}ms \x1b[2m(harness HTTP round-trip)\x1b[0m`)

      const targetColor = routeMs <= 8000 ? GREEN : RED
      console.log(`  8-second target:   ${targetColor(routeMs <= 8000 ? "✓ WITHIN TARGET" : "✗ EXCEEDED")}`)
      console.log("")
    }

    // Show what the VoiceCommandBar would display
    if (b.status === "success") {
      console.log(BOLD("WHAT VOICECOMMANDBAR WOULD SHOW"))
      console.log("─".repeat(60))
      console.log(`  Intent:           ${CYAN(String(b.intent || "—"))}`)
      console.log(`  Confidence:       ${b.confidence ?? "—"}`)
      console.log(`  Requires approval:${b.requiresApproval ? RED(" YES") : GREEN(" NO (read-only)")}`)

      if (b.resolvedTransaction && typeof b.resolvedTransaction === "object") {
        const tx = b.resolvedTransaction as Record<string, unknown>
        console.log(`  Matched file:     ${GREEN(String(tx.address || "—"))}, ${tx.city || "—"}`)
        console.log(`  Transaction ID:   ${String(tx.id || "—")}`)
      } else {
        console.log(`  Matched file:     ${YELLOW("None — no transaction resolved")}`)
      }

      if (b.commandId) {
        console.log(`  Command ID:       ${String(b.commandId)} \x1b[2m(logged to VoiceCommand table ✓)\x1b[0m`)
      }

      if (b.summary) {
        console.log(`  Summary:          "${String(b.summary).slice(0, 120)}${String(b.summary).length > 120 ? "…" : ""}"`)
      }

      if (b.actionResult) {
        console.log("")
        console.log(BOLD("ACTION RESULT"))
        console.log("─".repeat(60))
        console.log(JSON.stringify(b.actionResult, null, 2)
          .split("\n")
          .map(l => `  ${l}`)
          .join("\n"))
      }

      if (b.previewContent) {
        console.log("")
        console.log(BOLD("DOCUMENT PREVIEW (first 400 chars)"))
        console.log("─".repeat(60))
        console.log(`  ${String(b.previewContent).slice(0, 400)}`)
        if (String(b.previewContent).length > 400) console.log("  \x1b[2m[truncated...]\x1b[0m")
      }

      console.log("")
    }

    if (b.status === "ambiguous") {
      console.log(BOLD(YELLOW("AMBIGUOUS MATCH — Multiple transactions found")))
      console.log("─".repeat(60))
      console.log("  Agent needs to clarify which file. VoiceCommandBar would show:")
      if (Array.isArray(b.ambiguousMatches)) {
        b.ambiguousMatches.forEach((m: unknown, i: number) => {
          if (m && typeof m === "object") {
            const match = m as Record<string, unknown>
            console.log(`  ${i + 1}. ${match.address} (confidence: ${match.confidence})`)
          }
        })
      }
      console.log("")
    }
  }
}

// ─── MAIN ROUTE TEST ──────────────────────────────────────────────────────────

async function runRouteTest(
  input: string,
  sessionToken: string,
  baseUrl: string,
  currentTransactionId?: string
): Promise<HarnessResult> {
  const start = Date.now()
  const failures: string[] = []
  const warnings: string[] = []

  const url = `${baseUrl}/api/tc/voice`
  const body = {
    transcript: input,
    currentTransactionId: currentTransactionId || null,
  }

  let statusCode = 0
  let responseBody: unknown = null
  let requestMs = 0

  try {
    const fetchStart = Date.now()
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Clerk reads the session from the Cookie header
        Cookie: `__session=${sessionToken}`,
      },
      body: JSON.stringify(body),
    })

    requestMs = Date.now() - fetchStart
    statusCode = res.status

    const text = await res.text()
    try {
      responseBody = JSON.parse(text)
    } catch {
      responseBody = { _raw: text }
      if (text.length > 0) {
        failures.push(`Response body is not JSON: ${text.slice(0, 200)}`)
      }
    }

    printRouteDiagnostics(statusCode, responseBody, requestMs)

    // Non-2xx is an automatic failure
    if (statusCode < 200 || statusCode >= 300) {
      failures.push(`HTTP ${statusCode} — route did not return a success response`)
    } else if (responseBody && typeof responseBody === "object") {
      validateVoiceRouteResponse(
        responseBody as Record<string, unknown>,
        failures,
        warnings
      )
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`Network error — could not reach ${url}: ${msg}`)

    if (msg.includes("ECONNREFUSED")) {
      failures.push(
        "Connection refused — is your dev server running? Start it with: npm run dev"
      )
    }
  }

  return {
    agentName: "voice (route mode)",
    input: {
      transcript: input,
      url,
      currentTransactionId: currentTransactionId || null,
    },
    output: responseBody,
    processingMs: requestMs,
    passed: failures.length === 0,
    failures,
    warnings,
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  printBanner()

  const args = parseArgs()
  const env = loadEnvTest()

  // Merge: CLI args override .env.test
  const sessionToken = args.token || env.AIRE_TEST_SESSION_TOKEN || ""
  const baseUrl = args.url || env.AIRE_TEST_BASE_URL || "http://localhost:3000"
  const input = args.input || ""
  const currentTransactionId = args.transaction || undefined

  // ── Validate setup ──
  if (!sessionToken) {
    console.log("\x1b[31m  ✗ No session token found.\x1b[0m")
    console.log("\x1b[2m  Set AIRE_TEST_SESSION_TOKEN in .env.test or pass --token\x1b[0m")
    console.log("")
    printSetupGuide()
    process.exit(1)
  }

  if (!input || input === "true") {
    console.log('\x1b[31m  ✗ No input provided. Use --input "your command here"\x1b[0m')
    console.log("")
    console.log("  Examples:")
    console.log('    \x1b[36mnpx tsx scripts/test-route.ts --input "inspection deadline on Seyburn"\x1b[0m')
    console.log('    \x1b[36mnpx tsx scripts/test-route.ts --input "summarize my current deals"\x1b[0m')
    console.log('    \x1b[36mnpx tsx scripts/test-route.ts --input "type an addendum for Seyburn, $3000 seller credit"\x1b[0m')
    console.log("")
    process.exit(1)
  }

  // ── Token freshness check ──
  const tokenWarning = checkTokenFreshness(sessionToken)
  if (tokenWarning) {
    console.log(`\x1b[33m  ⚠ ${tokenWarning}\x1b[0m`)
    console.log("")
  }

  // ── Show what we're about to do ──
  console.log("\x1b[1mROUTE MODE\x1b[0m")
  console.log("─".repeat(60))
  console.log(`  Target:     \x1b[36m${baseUrl}/api/tc/voice\x1b[0m`)
  console.log(`  Input:      "${input}"`)
  console.log(`  Token:      ${sessionToken.slice(0, 20)}... \x1b[2m(${sessionToken.length} chars)\x1b[0m`)
  if (currentTransactionId) {
    console.log(`  Tx context: ${currentTransactionId}`)
  }
  console.log("")

  const result = await runRouteTest(input, sessionToken, baseUrl, currentTransactionId)

  printResult(result)
  process.exit(result.passed ? 0 : 1)
}

main().catch(err => {
  console.error("\x1b[31mHarness crashed:\x1b[0m", err)
  process.exit(1)
})
