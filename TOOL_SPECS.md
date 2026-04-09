# AIRE PLATFORM — PASTE THIS INTO CLAUDE CODE

Read CLAUDE.md, ROADMAP.md, and TOOL_SPECS.md first. Then execute this plan in order.

## CURRENT STATE (verified April 9, 2026):
- 117 API routes, 37 Prisma models, 14 agent libraries
- 13 cron routes exist but only 9 registered in vercel.json
- 11 files use circuit breaker, 16 use logError, 9 pages have FeedbackButtons
- Chrome extension exists at chrome-extension/
- Managed session manager exists at lib/agents/managed-session.ts
- Self-learning engine exists: FeedbackLog, ErrorMemory, PromptVersion, circuit breaker

## IMMEDIATE FIXES (do these first):

### Fix 1: Register missing crons in vercel.json
Add these 3 missing crons to vercel.json:
```json
{ "path": "/api/cron/deal-rescue", "schedule": "0 6 * * *" },
{ "path": "/api/cron/lead-scoring", "schedule": "0 8 * * 1" },
{ "path": "/api/cron/kpi-tracker", "schedule": "0 3 1 * *" }
```

### Fix 2: Write TOOL_SPECS.md
Create TOOL_SPECS.md at the project root with the complete tool specifications for every AIRE tool. This document is the single source of truth for what each tool does at perfect performance. Every agent building any part of AIRE must read this file first.

The tools and their perfect-state specifications:

---

**1. MORNING BRIEF** (`/aire/morning-brief`)
Opens with a conversational paragraph: "Good morning, Caleb. Three things need your attention before 10 AM." Then breaks into structured sections:
- URGENT (red): Deadlines expiring today, counters expiring, docs needed NOW
- ACTION ITEMS (amber): Calls to make, emails to send, docs to upload
- PIPELINE UPDATE: Which deals moved, which stalled, total pipeline value change
- RELATIONSHIP FOLLOW-UPS: Top 3 contacts to reach out to today with full brief
- MARKET INTEL: One-line market insight relevant to active deals
Each item has a one-tap action button (call, email, navigate to deal). The brief generates at 6:30 AM CT automatically. Users can also tap "Generate Now" anytime. Thumbs up/down feedback at the bottom feeds the learning system.

---

**2. EMAIL INTELLIGENCE** (`/aire/email`)
Scans Gmail every 30 minutes. Primary job: find every real estate PDF, document, and attachment — extract it, label it, and file it to the correct transaction folder. Shows a clean triage inbox:
- NEEDS FILING: PDFs/docs found but not yet filed. Shows preview + suggested transaction. Agent taps "File to [address]" or "Not relevant."
- NEEDS RESPONSE: Emails from buyers/sellers/lenders that haven't been replied to in 24+ hours. Shows draft reply button.
- MISSED CALLS: Calls with no follow-up. Shows "Call back" button.
Every auto-file action requires agent confirmation. Nothing moves without approval. The system learns from every approval/rejection to get better at matching documents to transactions.

---

**3. AIRSIGN** (`/airsign`)
One-tap e-signatures for Louisiana LREC forms. The signing experience:
- Agent uploads PDF, places signature/date/initial fields by clicking on the document
- Agent adds signers (buyer name + email, seller name + email)
- Agent taps "Send" — signers get branded email with signing link
- Signer opens link on phone → sees first field highlighted → taps to sign → auto-scrolls to next field → progress bar shows "2 of 5 fields complete" → guided step-by-step
- After all fields: "Review & Submit" screen showing completed document
- After all signers complete: sealed PDF with audit certificate (SHA-256 hash, timestamps, IPs)
- Agent gets notification: "Purchase agreement fully executed"
Sequential signing: buyer signs first, then seller gets invited after buyer completes. Decline to sign option with reason. Links expire after 14 days.

---

**4. CONTACTS / RELATIONSHIPS** (`/aire/relationships`)
Weekly AI-scored hit list of who to contact. When AIRE says "Call Sarah Johnson today", tapping her name shows a full relationship brief:
- Name, phone, email, last 3 interactions (with dates)
- Deal history (past transactions, current deals)
- What stage they're in (lead, active buyer, under contract, past client)
- AI-generated talking points based on their situation
- Suggested opening line matching the agent's communication style
- One-tap: Call, Text, Email buttons
The relationship intelligence runs weekly (Monday 6 AM). 4 AI agents score each contact on: communication frequency, life events, market timing, recency. Top contacts surface in the morning brief.

---

**5. CALENDAR** (`/aire/calendar` — needs to be built)
Full Google Calendar integration. AIRE has FULL calendar control:
- Reads calendar to know when agent is free/busy
- Creates events automatically: inspection appointments, showing times, closing dates
- Moves events when dates change on a transaction (closing pushed back = calendar updates)
- Sends reminders before deadlines: "Inspection at 123 Main St in 2 hours"
- Suggests optimal scheduling: "BR Home Inspections is available Tuesday 2pm or Thursday 10am. Which works?"
All event creation requires agent approval via the morning brief or a push notification. Calendar is the connective tissue — every deadline, showing, and closing lives here.

---

**6. VOICE COMMANDS** (mic button in top bar)
Agent taps mic or presses "/" to open voice overlay. Can speak or type. AIRE responds by voice (text-to-speech) AND text.

Core principle: **Smart follow-up questions.** AIRE infers what it can from context, asks only what's missing.

Example flows:
- "Start a listing for 1928 Eagle Street" → AIRE: "Got it. What's the list price?" → "$285,000" → "Occupied by owner, tenant, or vacant?" → "Owner" → "File created. You'll need 10 documents. Want me to generate the listing agreement?"
- "What docs am I missing on Eagle Street?" → "You're 60% complete. Missing: Property Disclosure, Wood Destroying Insect Report, Survey, and Insurance Binder."
- "Send the purchase agreement to the buyer for signatures" → Creates AirSign envelope, adds buyer as signer, redirects to field placement
- "Show my pipeline" → Lists all active deals with status and next action
- "Fill the MLS for Eagle Street" → Opens MLS auto-fill wizard

Voice pipeline target: spoken command → action complete in under 8 seconds. Uses Whisper for transcription (handles Louisiana place names). Falls back to browser speech + regex fast-path if AI is down.

---

**7. DOCUMENT PIPELINE** (upload in transaction detail + `/aire/documents`)
Drag-and-drop PDF upload. System instantly:
1. Classifies the document (Purchase Agreement, Disclosure, Inspection Report, etc.) — shows classification badge with confidence
2. Extracts key fields (buyer, seller, price, dates, address) — shows inline
3. Auto-files to the correct transaction — matches by address/parties
4. Advances the workflow state machine — "Inspection report uploaded → mark inspection deadline complete"
5. Updates the document checklist — shows what's still missing for this phase
6. Logs to document memory — every classification feeds the learning system

The checklist knows what phase you're in:
- Pre-listing: 10 docs (listing agreement, PDD, agency disclosure, MLS input, photos, termite, etc.)
- Buyer side: 5 docs (buyer agency, pre-approval, proof of funds, etc.)
- Under contract: 10 docs (purchase agreement, addenda, inspection, appraisal, title, etc.)
- Closing: 4 docs (closing disclosure, final walkthrough, wire confirmation, deed)

---

**8. MLS AUTO-FILL** (`/aire/mls-input` + Chrome extension)
Agent uploads an appraisal or old listing PDF. AIRE extracts ALL 37 Paragon MLS fields:
- Location: address, city, zip, tax ID, lot #, subdivision, school system
- Property: beds, baths, sqft, stories, age, lot dimensions, acres
- Features: cooling, heating, foundation, siding, style, parking, utilities
- Agent: list agent (auto-filled from profile), list office, occupied by, list type

After extraction, AIRE fills the Paragon form IMMEDIATELY via the Chrome extension. Then shows a full preview of what was inputted. Asks guided questions for features: "Do you want to add pool? Fireplace? Covered patio?" Always saves as PARTIAL listing — never makes it live or "Just Listed." Agent reviews in Paragon and publishes manually.

The Chrome extension shows a progress bar: "Filling 37 fields..." with green highlights on filled fields and red on any missing required fields.

---

**9. CONTRACT WRITER** (`/aire/contracts/new`)
Agent types plain English: "Purchase agreement for 1928 Eagle Street, buyer Homer Simpson, seller Ned Flanders, price $315,000, closing May 15, conventional financing, 10-day inspection"

AIRE:
1. Parses every entity (address, names, price, dates, financing type, inspection period)
2. Shows field preview — agent verifies before generating
3. Generates PDF with Louisiana-specific clauses (inspection, financing, termite, flood zone, lead paint if pre-1978, mineral rights, property condition)
4. Download button + "Send for Signatures" button (creates AirSign envelope)
5. Saves to contracts list

Error guidance: if NL parsing fails, shows example format instead of vague error.

---

**10. COMPLIANCE SCANNER** (`/aire/compliance`)
Scans ALL active transactions against Louisiana LREC rules. HIGH PRIORITY enforcement:
- Missing disclosures → RED alert, won't stop nagging until uploaded
- Missed deadlines → RED alert with days overdue
- Missing signatures → YELLOW alert
- Document completeness → percentage by transaction

Compliance issues are PERSISTENT — they don't go away when dismissed. They stay in the morning brief, they stay on the transaction detail, they stay on the dashboard until RESOLVED. The agent must upload the correct document or complete the action to clear the alert. This protects the Louisiana real estate license.

---

**11. TRANSACTION COORDINATOR** (`/aire/transactions`)
The hub. Every deal lives here. List view with search (address, buyer, seller, MLS#), filter (status), sort (closing date, price, recent).

Transaction detail has 5 tabs:
- Overview: property info, parties, price, status, days on market
- Deadlines: grouped by urgency (overdue red, today orange, upcoming yellow), one-tap complete
- Documents: upload zone, checklist showing what's missing, classified docs with extraction
- Communications: quick-send templates (Offer Accepted, Inspection Scheduled, Closing Update)
- Contracts: generated contracts with download + AirSign links

Pipeline value header shows total active deal value. Badge on sidebar shows active count + overdue count.

---

## WHAT TO BUILD / FIX NOW:

1. Register the 3 missing crons in vercel.json (deal-rescue, lead-scoring, kpi-tracker)
2. Write this TOOL_SPECS.md file to the project root
3. Build the Calendar page (`/aire/calendar`) — Google Calendar integration with full read/write control, event creation with approval, deadline syncing
4. Verify all 13 cron routes have proper CRON_SECRET auth (pattern: `if (!CRON_SECRET || authHeader !== ...)`)
5. Run `npx tsc --noEmit` and fix any type errors
6. Commit and push to main

After these are done, every tool in the sidebar will be functional and every background agent will be running on schedule.
