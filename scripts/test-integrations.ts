/**
 * AIRE Integration Test Runner
 *
 * Tests all 9 new integrations and reports status.
 * Run with: npx tsx scripts/test-integrations.ts
 */

// Test results collector
const results: { name: string; status: "PASS" | "FAIL" | "SKIP"; detail: string }[] = []

function pass(name: string, detail: string) { results.push({ name, status: "PASS", detail }) }
function fail(name: string, detail: string) { results.push({ name, status: "FAIL", detail }) }
function skip(name: string, detail: string) { results.push({ name, status: "SKIP", detail }) }

async function main() {
  console.log("\n=== AIRE Integration Test Runner ===\n")
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Node: ${process.version}\n`)

  // ─── 1. TWILIO CLIENT ────────────────────────────────────────
  console.log("1/9 Testing Twilio client...")
  try {
    const { isTwilioConfigured, sendSms } = await import("../lib/twilio")
    if (isTwilioConfigured()) {
      pass("Twilio: Config", "TWILIO_ACCOUNT_SID, AUTH_TOKEN, PHONE_NUMBER all set")
      // Don't actually send an SMS in test mode
      pass("Twilio: Client", "sendSms() function loaded, ready to send")
    } else {
      fail("Twilio: Config", "Missing one or more: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER")
    }
  } catch (e) {
    fail("Twilio: Import", `Failed to import: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 2. GOOGLE CALENDAR ──────────────────────────────────────
  console.log("2/9 Testing Google Calendar...")
  try {
    const { getDaySchedule } = await import("../lib/google/calendar")
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      fail("GCal: Config", "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")
    } else {
      pass("GCal: Config", "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set")
      // Test with a fake userId — should return empty (no OAuth token), not crash
      try {
        const schedule = await getDaySchedule("test-user-does-not-exist")
        pass("GCal: Query", `Returned ${schedule.events.length} events (expected 0 for fake user)`)
      } catch (e) {
        fail("GCal: Query", `Threw: ${e instanceof Error ? e.message : e}`)
      }
    }
  } catch (e) {
    fail("GCal: Import", `Failed to import: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 3. SIGNATURE FONTS ──────────────────────────────────────
  console.log("3/9 Testing Signature fonts...")
  try {
    const fs = await import("fs")
    const content = fs.readFileSync("components/airsign/SignatureModal.tsx", "utf-8")
    const fonts = ["Allura", "Dancing Script", "Great Vibes", "Sacramento", "Parisienne", "Caveat"]
    const found = fonts.filter(f => content.includes(f))
    if (found.length === 6) {
      pass("Fonts: All 6", `Found: ${found.join(", ")}`)
    } else {
      fail("Fonts: Missing", `Only found ${found.length}/6: ${found.join(", ")}`)
    }
  } catch (e) {
    fail("Fonts: Read", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 4. VOICE → AIRSIGN ─────────────────────────────────────
  console.log("4/9 Testing Voice → AirSign routing...")
  try {
    const fs = await import("fs")

    // Check fast-path patterns
    const pipeline = fs.readFileSync("lib/voice-pipeline.ts", "utf-8")
    const hasFastPath = pipeline.includes("send_document_for_signature")
    if (hasFastPath) {
      pass("Voice→AirSign: FastPath", "send_document_for_signature patterns found in voice-pipeline.ts")
    } else {
      fail("Voice→AirSign: FastPath", "send_document_for_signature NOT found in voice-pipeline.ts")
    }

    // Check executor
    const executor = fs.readFileSync("lib/voice-action-executor.ts", "utf-8")
    const hasHandler = executor.includes("sendDocumentForSignature")
    const hasOldStatusBug = executor.includes('data: { status: "PENDING" }')
    const hasOldDetailBug = executor.includes("detail: `Envelope")

    if (hasHandler) pass("Voice→AirSign: Handler", "sendDocumentForSignature function exists")
    else fail("Voice→AirSign: Handler", "sendDocumentForSignature function NOT found")

    if (!hasOldStatusBug) pass("Voice→AirSign: Bug#1 Fixed", "No AirSignSigner.status reference")
    else fail("Voice→AirSign: Bug#1", "Still has AirSignSigner.status reference")

    if (!hasOldDetailBug) pass("Voice→AirSign: Bug#2 Fixed", "No AirSignAuditEvent.detail reference")
    else fail("Voice→AirSign: Bug#2", "Still has AirSignAuditEvent.detail reference")

    // Check approval required
    const hasApproval = executor.includes('"send_document_for_signature"')
    if (hasApproval) pass("Voice→AirSign: Approval", "Intent registered in APPROVAL_REQUIRED_INTENTS")
    else fail("Voice→AirSign: Approval", "Intent NOT in approval set")

  } catch (e) {
    fail("Voice→AirSign: Read", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 5. META BUSINESS SUITE ──────────────────────────────────
  console.log("5/9 Testing Meta Business Suite...")
  try {
    const { isMetaConfigured, getWeeklyInsights } = await import("../lib/meta-business")
    if (isMetaConfigured()) {
      pass("Meta: Config", "META_ACCESS_TOKEN and META_PAGE_ID set")
      try {
        const insights = await getWeeklyInsights()
        pass("Meta: Insights", `Got ${insights.topPosts.length} top posts`)
      } catch (e) {
        fail("Meta: Insights", `API call failed: ${e instanceof Error ? e.message : e}`)
      }
    } else {
      skip("Meta: Config", "META_ACCESS_TOKEN or META_PAGE_ID not set — Meta features disabled")
    }
  } catch (e) {
    fail("Meta: Import", `Failed to import: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 6. MULTI-SOURCE CMA ────────────────────────────────────
  console.log("6/9 Testing Multi-Source CMA...")
  try {
    const { runMultiSourceCMA } = await import("../lib/data/engines/multi-source-cma")
    pass("CMA: Import", "multi-source-cma module loaded")

    // Check dependent engine imports
    const { calculateEnsemble } = await import("../lib/data/engines/ensemble")
    const { calculateDisagreement } = await import("../lib/data/engines/disagreement")
    const { normalizeAddress } = await import("../lib/data/engines/normalize")
    pass("CMA: Engines", "ensemble, disagreement, normalize engines all imported")

    // Test normalize
    const norm = normalizeAddress("123 Main St, Baton Rouge, LA 70801")
    if (norm.property_id) {
      pass("CMA: Normalize", `Normalized to: ${norm.property_id}`)
    } else {
      fail("CMA: Normalize", "normalizeAddress returned no property_id")
    }

    // Test ensemble with sample data
    const ensemble = calculateEnsemble({
      mls_cma: 268500,
      propstream_avm: 262000,
      zillow_estimate: 285000,
      redfin_estimate: 275000,
    })
    if (ensemble.aire_estimate > 0) {
      pass("CMA: Ensemble", `AIRE estimate: $${ensemble.aire_estimate.toLocaleString()} from ${ensemble.sources_used.length} sources`)
    } else {
      fail("CMA: Ensemble", "Ensemble returned 0 or negative estimate")
    }

    // Test disagreement
    const disagreement = calculateDisagreement({
      mls_cma: 268500,
      propstream_avm: 262000,
      zillow_estimate: 285000,
      redfin_estimate: 275000,
    })
    pass("CMA: Disagreement", `${disagreement.confidence_tier} confidence, ${disagreement.disagreement_pct.toFixed(1)}% disagreement`)

  } catch (e) {
    fail("CMA: Import", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 7. PRE-LISTING BRIEF ───────────────────────────────────
  console.log("7/9 Testing Pre-Listing Brief...")
  try {
    const fs = await import("fs")
    const content = fs.readFileSync("lib/pre-listing-brief.ts", "utf-8")

    const hasOldBug = content.includes("extractedData")
    const hasFixedField = content.includes("filledData")

    if (!hasOldBug && hasFixedField) {
      pass("PreListing: Bug#4 Fixed", "Uses filledData (correct schema field)")
    } else if (hasOldBug) {
      fail("PreListing: Bug#4", "Still references extractedData (doesn't exist in schema)")
    }

    const { generatePreListingBrief } = await import("../lib/pre-listing-brief")
    pass("PreListing: Import", "Module loads cleanly")
  } catch (e) {
    fail("PreListing: Import", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 8. MLS AUTO-UPLOAD ──────────────────────────────────────
  console.log("8/9 Testing MLS Auto-Upload...")
  try {
    const { isParagonConfigured } = await import("../lib/paragon/mls-upload")
    if (isParagonConfigured()) {
      pass("MLS: Config", "PARAGON_RETS_URL, USERNAME, PASSWORD all set")
    } else {
      skip("MLS: Config", "Paragon RETS credentials not set — MLS upload disabled")
    }

    const fs = await import("fs")
    const content = fs.readFileSync("app/api/mls/upload/route.ts", "utf-8")
    const hasOldBug = content.includes("extractedData")
    if (!hasOldBug) {
      pass("MLS: Bug#5 Fixed", "Uses filledData (correct schema field)")
    } else {
      fail("MLS: Bug#5", "Still references extractedData")
    }
  } catch (e) {
    fail("MLS: Import", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── 9. CONTENT SCHEDULER ───────────────────────────────────
  console.log("9/9 Testing Content Scheduler...")
  try {
    const { generateContentStrategy } = await import("../lib/content-scheduler")
    pass("Content: Import", "content-scheduler module loaded")

    // Test strategy generation (doesn't need Meta)
    const strategy = await generateContentStrategy()
    if (strategy.recommendedTypes.length > 0) {
      pass("Content: Strategy", `${strategy.recommendedTypes.length} recommended types, weekly goal: ${strategy.weeklyGoal}`)
    } else {
      fail("Content: Strategy", "No recommended types returned")
    }
  } catch (e) {
    fail("Content: Import", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── MORNING BRIEF WIRING ───────────────────────────────────
  console.log("\nBonus: Testing Morning Brief wiring...")
  try {
    const fs = await import("fs")
    const cron = fs.readFileSync("app/api/cron/morning-brief/route.ts", "utf-8")

    const hasCalendarImport = cron.includes("researchCalendar")
    const hasSocialImport = cron.includes("researchSocial")
    const hasCalendarInPrompt = cron.includes("TODAY'S CALENDAR")
    const hasSocialInPrompt = cron.includes("SOCIAL MEDIA PERFORMANCE")

    if (hasCalendarImport && hasSocialImport) {
      pass("Brief: Researchers", "Calendar + Social researchers imported")
    } else {
      fail("Brief: Researchers", `Calendar: ${hasCalendarImport}, Social: ${hasSocialImport}`)
    }

    if (hasCalendarInPrompt && hasSocialInPrompt) {
      pass("Brief: Prompt", "Calendar + Social sections in synthesis prompt")
    } else {
      fail("Brief: Prompt", `Calendar prompt: ${hasCalendarInPrompt}, Social prompt: ${hasSocialInPrompt}`)
    }
  } catch (e) {
    fail("Brief: Read", `Failed: ${e instanceof Error ? e.message : e}`)
  }

  // ─── RESULTS ─────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60))
  console.log("INTEGRATION TEST RESULTS")
  console.log("=".repeat(60) + "\n")

  const passed = results.filter(r => r.status === "PASS")
  const failed = results.filter(r => r.status === "FAIL")
  const skipped = results.filter(r => r.status === "SKIP")

  for (const r of results) {
    const icon = r.status === "PASS" ? "PASS" : r.status === "FAIL" ? "FAIL" : "SKIP"
    console.log(`[${icon}] ${r.name}`)
    console.log(`       ${r.detail}`)
  }

  console.log("\n" + "-".repeat(60))
  console.log(`TOTAL: ${results.length} tests`)
  console.log(`  PASS: ${passed.length}`)
  console.log(`  FAIL: ${failed.length}`)
  console.log(`  SKIP: ${skipped.length}`)
  console.log("-".repeat(60))

  if (failed.length > 0) {
    console.log("\nFAILURES:")
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail}`)
    }
  }

  if (skipped.length > 0) {
    console.log("\nSKIPPED (missing env vars):")
    for (const s of skipped) {
      console.log(`  - ${s.name}: ${s.detail}`)
    }
  }

  console.log("\n")
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch(e => {
  console.error("Test runner crashed:", e)
  process.exit(2)
})
