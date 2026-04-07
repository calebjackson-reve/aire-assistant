# Playwright MCP Testing Protocol
**For all AIRE agents — CEO-directed automated testing**

## How It Works
The CEO agent (Claude Code) uses Chrome DevTools MCP to control a browser, navigate every page, screenshot results, and fix bugs in real-time. Each agent's work gets verified through this loop.

## Available MCP Tools
```
navigate_page   — Go to URL
take_screenshot  — Visual verification
take_snapshot    — DOM/accessibility tree (for clicking elements)
click            — Click element by uid
fill             — Type into inputs
evaluate_script  — Run JS on the page (for canvas clicks, etc.)
list_pages       — See open tabs
```

## Pre-Test Checklist
1. Dev server running on `http://localhost:3000`
2. User signed in via Clerk (CEO handles this manually once)
3. All env vars set in `.env.local`

## Test Loop Per Tool

### AirSign (Agent 1)
1. `/airsign` — Dashboard loads, envelope counts correct
2. `/airsign/new` — Create envelope form renders
3. `/airsign/[id]` — PDF renders (canvas visible, no "Failed to load")
4. Place fields via `evaluate_script` (click on canvas coordinates)
5. Save fields — verify count updates
6. Send for signing — check console/network for Resend API call
7. `/sign/[token]` — Public signing page renders PDF + fields
8. Complete signing — verify sealed PDF generates

### Transaction Coordinator (Agent 2)
1. `/aire/transactions` — List loads, search/filter/sort work
2. `/aire/transactions/new` — Create form renders all fields
3. Fill form + submit — verify redirect to detail
4. `/aire/transactions/[id]` — 5 tabs render (Overview, Deadlines, Documents, Comms, Contracts)
5. Mark deadline complete — verify DB update
6. Upload document in Documents tab — verify classification + extraction

### Document Pipeline (Agent 3)
1. Upload PDF via transaction detail Documents tab
2. Verify classification badge appears
3. Verify extracted fields display inline
4. Test with text-based PDF and scanned PDF
5. Verify auto-filing to correct transaction

### Additional Pages (Quick Smoke Test)
- `/aire` — Dashboard with pipeline value, stats, morning brief
- `/aire/morning-brief` — Brief renders, approve/dismiss buttons work
- `/aire/compliance` — Scanner results with critical/warning badges
- `/aire/contracts` — List + Write Contract button
- `/aire/email` — Triage dashboard, Connect Gmail CTA
- `/aire/intelligence` — AVM search, scored properties
- `/aire/voice-analytics` — Metrics dashboard
- `/billing` — 3 tiers render correctly

## Bug Fix Loop
```
1. Navigate to page
2. Screenshot
3. If error visible:
   a. Check console messages
   b. Read the source file
   c. Fix the bug
   d. Reload
   e. Screenshot again
   f. Repeat until clean
4. Move to next page
```

## Test Results Format
After each test run, update `AGENT_MISSIONS/TEST_RESULTS.md`:
```
| Page | Status | Bug Found | Fix Applied | Verified |
|------|--------|-----------|-------------|----------|
```

## Completed Test Run — April 4, 2026

| Page | Status | Bug Found | Fix Applied |
|------|--------|-----------|-------------|
| Dashboard | PASS | — | — |
| AirSign Dashboard | PASS | — | — |
| AirSign Detail | PASS | PDF failed to load | Local worker fix |
| AirSign Field Placer | PASS | — | — |
| Transactions List | PASS | — | — |
| Transaction Detail | PASS | — | — |
| Morning Brief | PASS | items.map crash | Array.isArray guard |
| Compliance | PASS | — | — |
| Contracts | PASS | — | — |
| Email | PASS | — | — |
| Billing | PASS | — | — |
| Intelligence | PASS | — | — |
| Voice Analytics | PASS | — | — |
