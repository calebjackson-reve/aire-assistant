# AGENTS.md — AIRE Agent Architecture
# All autonomous AI workers for the AIRE Intelligence Platform
# Caleb Jackson | Reve REALTORS | Baton Rouge, Louisiana | March 2026

---

## Architecture Pattern

Every agent follows this pipeline — no exceptions:

```
Trigger → Gather Context → AI Processing → Human Approval Gate → Execute → Log
```

The approval gate is non-negotiable. AIRE never takes a client-facing action
without explicit agent approval. This protects the Louisiana real estate license.

All agents use `claude-sonnet-4-20250514` unless noted otherwise.
All agents log to the database for the patent audit trail.

---

## The 7 Core AIRE Agents

### Agent 1 — Transaction Agent
- **Route:** `/api/agents/transaction`
- **Trigger:** New contract uploaded, document added, email classified, manual command
- **Job:** Full transaction lifecycle — deadlines, documents, compliance, closing coordination
- **Reads:** Transaction, Party, Deadline, Document, EmailLog tables
- **Writes:** Deadline, Document, VoiceCommand, EventLog tables
- **Approval required:** All client-facing communications, document routing
- **Status:** Partial — deadline tracking exists, voice commands partially built

### Agent 2 — Voice Command Agent
- **Route:** `/api/voice-command`
- **Trigger:** Voice or text command from VoiceCommandBar
- **Job:** Speech → intent classification → entity extraction → transaction match → action
- **Target:** Under 8 seconds spoken command to completed action
- **Patent:** This is the primary patent claim — every command logs to VoiceCommand table
- **Known failures:** Route may use prisma.user instead of prisma.agent — verify
- **Approval required:** All write actions (draft, route, schedule). Read-only = no approval.
- **Status:** Route exists at `/api/voice-command/route.ts` — needs audit against voice spec

Voice intent types:
```
draft_addendum | draft_counter | draft_repair_request | route_doc |
schedule_vendor | deadline_check | deal_summary | cma_request |
lead_info | content_gen | deal_analysis | other
```

### Agent 3 — Email Scan Agent
- **Route:** `/api/cron/email-scan` (runs every 15 minutes)
- **Trigger:** Vercel cron job
- **Job:** Reads Gmail inbox, classifies emails, routes to correct transaction file
- **Auth:** Gmail API OAuth2 — read-only scope. Never modifies or deletes.
- **Urgency levels:** URGENT (counter, title issue) → SMS immediately | HIGH → dashboard | NORMAL → brief
- **Status:** Not yet built

### Agent 4 — Morning Brief Agent
- **Route:** `/api/cron/morning-brief` (runs 6:30 AM daily)
- **Trigger:** Vercel cron — 30 min after Transaction Agent scans deadlines
- **Job:** Synthesizes overnight emails + deadlines + pending approvals into ranked action list
- **Output:** Dashboard card + optional SMS + optional email
- **Format:** Flowing sentences, not bullet points. "You have a counter on Seyburn..."
- **Status:** Not yet built

### Agent 5 — Content Agent
- **Route:** `/api/content/generate-post`
- **Trigger:** New listing detected, content calendar scheduled date, manual request
- **Job:** Generates all listing content — MLS description, social posts, email, SMS, postcard
- **Approval required:** ALL content staged for review. Fair Housing check runs first.
- **Status:** Route exists — needs full pipeline build

### Agent 6 — Intelligence Agent
- **Route:** `/api/agents/intelligence`
- **Trigger:** On demand, lead scoring nightly at 11 PM, KPI report Monday 7 AM
- **Job:** CMA generation, deal analysis, lead scoring, KPI tracking
- **Louisiana-specific:** Paragon MLS comps, adjustment grid, flood zone weighting
- **Status:** Not yet built

### Agent 7 — Compliance Agent
- **Route:** `/api/agents/compliance`
- **Trigger:** Any AI-generated document, any content before approval
- **Job:** Fair Housing check, LREC compliance, disclosure verification, data accuracy
- **Output:** Green (passed) | Yellow (review) | Red (blocked)
- **Status:** Not yet built

---

## Agent Teams (Synaptic Consensus Analysis — March 2026)

These are multi-agent teams that run parallel agents and synthesize results.
Built on top of `lib/agents/consensus.ts`.

### Team 1 — Relationship Intelligence ✅ BUILT
- **File:** `lib/agents/relationship-intelligence.ts`
- **Cron:** `/api/cron/relationship-intelligence` — every Monday 6:00 AM CST
- **UI:** `/aire/relationships` — weekly hit list
- **Schema:** Contact, RelationshipIntelLog tables

The 4 agents:
- **Agent A** — Behavioral Signal Scanner (communication frequency, response patterns)
- **Agent B** — Life Event Detector (language signals: job change, lease expiry, family)
- **Agent C** — Market Timing Analyst (equity position, neighborhood conditions, rate environment)
- **Agent D** — Recency & Warmth Scorer (last contact, response rate, relationship history)
- **Synthesis** — Weekly Hit List (top 10 contacts, ranked, with suggested message per contact)

Scoring: Behavioral 30% + Life Event 25% + Market Timing 25% + Recency 20%
Consensus: Contacts scoring 60+ go through 3-run consensus before final recommendation
Output: Call / Text / Email / Skip + pre-written opening message + score breakdown

### Team 2 — Deal Rescue Team ⏳ QUEUED
- **Trigger:** Nightly, all active transactions
- **Schema needed:** DealHealthLog model

The 4 agents:
- **Agent A** — Timeline Analyst (deadlines within 72 hours with no completion confirmation)
- **Agent B** — Communication Gap Detector (parties silent for 48+ hours on active threads)
- **Agent C** — Document Completeness Auditor (required docs vs what's actually in file)
- **Agent D** — Sentiment Analyzer (last 5 communications scored for declining sentiment)
- **Synthesis** — Deal Health Scorer (1-10 score per transaction + rescue brief)

### Team 3 — LREC Guardian ⏳ QUEUED
- **Trigger:** Before every broker submission
- **Schema needed:** ComplianceAuditLog model

The 3 agents:
- **Agent A** — Document Completeness Auditor
- **Agent B** — Deadline Compliance Auditor
- **Agent C** — Disclosure Compliance Auditor
- **Synthesis** — Broker Submission Report (Green/Yellow/Red + exact gaps)

### Team 4 — Seller Pricing War Room ⏳ QUEUED
- **Trigger:** On demand, before listing appointments
- **Schema needed:** PricingAnalysisLog model

The 4 agents:
- **Agent A** — Market Analyst (Louisiana CMA, Paragon comps, adjustment grid)
- **Agent B** — Buyer Perception Analyst (Zillow vs PropStream vs Paragon AVM gap)
- **Agent C** — DOM Consequence Modeler (price → DOM projection → net proceeds at 30/60/90 days)
- **Agent D** — Objection Anticipator (top 5 seller objections + responses)
- **Synthesis** — Pricing Conversation Brief (Focus First buckets, comp stories, objection prep)

### Team 5 — Autonomous Marketing Machine ⏳ QUEUED
- **Trigger:** New listing detected in Paragon MLS
- **Schema needed:** ContentCampaign model

The 4 agents:
- **Agent A** — Listing Story Extractor (3 most compelling features + ideal buyer persona)
- **Agent B** — Content Matrix Generator (MLS, Instagram, Facebook, LinkedIn, email, SMS, postcard)
- **Agent C** — Objection Inoculator (preemptive responses woven into copy)
- **Agent D** — 30-Day Calendar Builder (posting schedule by platform)
- **Synthesis** — Campaign Package (full approval-ready content bundle)

### Team 6 — Negotiation Intelligence ⏳ QUEUED
- **Trigger:** Counter offer received (detected by Email Scan Agent)
- **Schema needed:** NegotiationLog model

The 4 agents:
- **Agent A** — Offer Anatomy Analyzer (every term broken down, flags buried issues)
- **Agent B** — Market Position Validator (counter price vs CMA range)
- **Agent C** — Motivation Profiler (reads prior communications for flexibility signals)
- **Agent D** — Scenario Modeler (accept / counter at X / counter at Y — projected outcomes)
- **Synthesis** — Negotiation Brief (3 options ranked by expected net proceeds)

### Meta-Agent — Learning Synthesis ⏳ FUTURE
- **Trigger:** Weekly, reads across all 6 team logs
- **Job:** Surfaces patterns — which signals most reliably predict deal health, which
  pricing strategies win, which contact behaviors precede transactions
- This is where AIRE becomes a learning platform, not just a tool

---

## Consensus Utility

- **File:** `lib/agents/consensus.ts`
- **Purpose:** Run same prompt N times, accept result only when majority agree
- **Use when:** Decision has real consequences — compliance, voice intent, field extraction

Presets:
```typescript
CONSENSUS_PRESETS.compliance         // 3 runs, 2/3 agree, compareKey: "passed"
CONSENSUS_PRESETS.voiceIntent        // 3 runs, 2/3 agree, compareKey: "intent"
CONSENSUS_PRESETS.documentExtraction // 3 runs, 2/3 agree, full object compare
CONSENSUS_PRESETS.cmaCompSelection   // 3 runs, 2/3 agree, compareKey: "selectedCompIds"
CONSENSUS_PRESETS.emailClassification// 3 runs, 2/3 agree, compareKey: "classification"
```

Usage:
```typescript
import { consensusCheck, CONSENSUS_PRESETS } from "@/lib/agents/consensus"

const result = await consensusCheck({
  feature: "voice_intent",
  agentId: agent.id,
  systemPrompt: VOICE_INTENT_PROMPT,
  userContent: transcript,
  ...CONSENSUS_PRESETS.voiceIntent,
})

if (result.agreed) {
  // use result.output safely
} else {
  // show disambiguation card — agents didn't agree
}
```

---

## Test Harness

- **Files:** `scripts/test-agent.ts`, `scripts/test-route.ts`
- **Purpose:** Test any agent without needing auth, DB, or running server

```powershell
# Test voice agent (no auth needed)
npx tsx scripts/test-agent.ts --agent voice --input "inspection deadline on Seyburn"

# Test email agent
npx tsx scripts/test-agent.ts --agent email --fixture counter-offer

# Test morning brief
npx tsx scripts/test-agent.ts --agent morning-brief

# Test real /api/voice-command route (needs session token in .env.test)
npx tsx scripts/test-route.ts --input "summarize my current deals"
```

Session token setup for route mode:
1. Sign in at localhost:3000
2. DevTools → Network → any /api/ request → Cookie header → copy `__session` value
3. Paste into `.env.test` as `AIRE_TEST_SESSION_TOKEN=...`

---

## Louisiana-Specific Rules (apply to ALL agents)

- All transaction logic understands Louisiana purchase agreements
- Mineral rights exclusions tracked on every transaction
- Flood zone classification (AE, X, AH) required on every property
- Compliance checks reference LREC rules — not generic NAR guidelines
- Parish-level data: East Baton Rouge, Ascension, Livingston, Pointe Coupee, West Feliciana
- All market content references Baton Rouge neighborhoods and parishes
- CMA adjustments: pool $7K-$25K, generator $10K-$20K, waterfront $25K-$100K+
- Methodology: Ninja Selling / Larry Kendall, Focus First three-bucket pricing

---

## Recovery Prompt (use when Claude Code loses session context)

If a Claude Code session loses context, paste this:

```
Read CLAUDE.md and AGENTS.md at the root of this project.
These files contain the full platform context, all known errors,
all built agent teams, and all non-negotiable rules.
Do not start writing any code until you have read both files.
```
