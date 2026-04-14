# TCS — Transaction Coordination System Master Plan

> **Flagship AI-guided transaction walkthrough.** A realtor with zero deal experience walks in, answers conversational questions, and closes the deal because every AIRE system is wired together behind the scenes.
>
> **Target price:** $50K–$100K/month per brokerage (multi-seat).
> **Bar:** A first-time agent at a new brokerage completes their first transaction end-to-end without knowing what a "purchase agreement" is.

---

## 0. Design Philosophy

TCS is **not** another kanban or checklist. It is a **conversational co-pilot** that:

1. **Asks one question at a time** in Caleb's voice (Space Grotesk body, warm editorial tone).
2. **Pulls data silently** in the background (MLS, CMA, parish records, contact history).
3. **Writes the docs** (LREC forms, addenda, agency disclosures) without the agent drafting a word.
4. **Schedules the deadlines** based on Louisiana rules (3/7/14/30-day contingencies).
5. **Sends the messages** to buyer, seller, lender, title, inspector, appraiser — on the right day, in the right tone.
6. **Advances the state machine** as each stage completes. The agent never picks a status.

Everything the agent already built — AirSign, document classifier, Louisiana rules engine, LREC contract writer, morning brief, voice pipeline, compliance scanner — is a **tool call** inside TCS, not a standalone destination.

---

## 1. The 8-Stage State Machine

The prompt calls for "7-stage" but the real LA transaction has 8 distinct phases. We'll add **INTAKE** in front of the existing `TransactionStatus` enum and collapse `CLOSED → POST_CLOSE` as a first-class stage rather than a terminal sink.

| # | Stage | TransactionStatus | What it means |
|---|-------|---|---|
| 1 | **Intake** | `DRAFT` | Agent has a lead. Property, parties, and deal shape being captured. No contract yet. |
| 2 | **Offer** | `ACTIVE` | Purchase agreement being drafted, negotiated, countered. Not yet mutually signed. |
| 3 | **Under Contract** | `UNDER_CONTRACT` *(new)* | Fully executed PA. Earnest money + disclosures in flight. Inspection window opens. |
| 4 | **Inspection** | `PENDING_INSPECTION` | Inspection scheduled, performed, response delivered, repairs/credits negotiated. |
| 5 | **Appraisal** | `PENDING_APPRAISAL` | Lender orders appraisal. Gap handling if low. |
| 6 | **Financing** | `PENDING_FINANCING` | Underwriting → commitment letter → clear to close. |
| 7 | **Closing** | `CLOSING` | Title work, CD delivery, walk-through, Act of Sale. |
| 8 | **Post-Close** | `POST_CLOSE` *(new)* | Utilities, review request, referral ask, anniversary drip, 1099, commission reconciliation. |

**Schema change:** add `UNDER_CONTRACT` and `POST_CLOSE` to `TransactionStatus`. Keep `CLOSED` as an alias terminal state for historic data; `POST_CLOSE` is the active post-closing window (0–60 days).

---

## 2. Per-Stage Playbook

Each stage has four mechanical outputs TCS produces automatically: **questions**, **data pulls**, **auto-docs**, **auto-deadlines**, **auto-messages**. The agent only answers the questions — everything else is derived.

### Stage 1 — Intake (`DRAFT`)
**Conversational questions** (one at a time, AI-paced):
1. "Is this a buyer you're representing or a listing you're taking?" *(side)*
2. "What's the address?" *(autocomplete against Paragon MLS + parish records)*
3. "Who's the client? Phone or email works — I'll pull the rest." *(match against Contact model; if new, capture)*
4. "Any other agent on this yet, or are we first in?" *(competing-offer signal)*
5. *(Listing side only)* "What price are we thinking? I'll run a CMA while we talk." *(triggers CMA agent)*

**Data pulls:**
- Paragon MLS → bed/bath/sqft/year built/lot/schools/photos
- Parish assessor → tax ID, legal description, owner of record, last sale price
- AIRE Estimate AVM → suggested list/offer band
- Contact model → prior history with this client
- Flood zone → FEMA layer for disclosure requirements

**Auto-docs generated:** Agency Disclosure (LREC Mandatory 02), Buyer/Seller Representation Agreement draft.

**Auto-deadlines:** None yet (no contract).

**Auto-messages:**
- Send Agency Disclosure to client via AirSign (draft, pending agent approve).
- If listing side: schedule "photos + sign install" task 3 days out.

**Exit criteria → Offer:** agency paperwork signed AND (buyer: shown ≥ 1 property) OR (listing: price + list date locked).

---

### Stage 2 — Offer (`ACTIVE`)
**Conversational questions:**
1. "What price are we offering and how's it funded — cash, conventional, FHA, VA, USDA?"
2. "What earnest money and when does it go hard?"
3. "Inspection window — 10 days standard, or different?"
4. "Any seller concessions or closing-cost help built in?"
5. "Target closing date? I'll make sure the financing timeline works."

**Data pulls:**
- Pricing war room (`lib/agents/pricing-war-room.ts`) → offer-gap analysis vs. comps
- Negotiation intelligence → counter-offer probability, seller motivation signal
- Current day-count on market from MLS

**Auto-docs generated:**
- LREC Residential Purchase Agreement (full fill via `lib/contracts/contract-writer.ts`)
- Property Disclosure request (if buyer side)
- Lead-Paint Disclosure (if pre-1978)
- Financing/Inspection/Appraisal contingency addenda

**Auto-deadlines (calculated from contract acceptance date):**
| Deadline | Default offset | LA basis |
|----------|---|---|
| Earnest money delivered | +3 business days | LREC best-practice |
| Inspection completion | +10 calendar days | Contract-default |
| Inspection response | +3 days after inspection | Contract-default |
| Appraisal order | +5 business days | Lender-typical |
| Appraisal received | +21 calendar days | Lender-typical |
| Financing commitment | +30 calendar days | Contract-default |
| Clear to close | +45 calendar days | Target |
| Closing | per contract | Required |

All Louisiana-specific rule overrides come from [lib/louisiana-rules-engine.ts](lib/louisiana-rules-engine.ts) via `calculateDeadlines({ contractDate, parish, loanType })`.

**Auto-messages:**
- Offer summary email to client ("Here's what we submitted, here's what happens next")
- Listing agent cover letter (if competing offers, generated via negotiation intel)
- Internal nudge: "Remind me tomorrow if seller hasn't responded"

**Exit criteria → Under Contract:** mutually-signed PA uploaded via AirSign webhook → `onDocumentUploaded` fires → state advances automatically.

---

### Stage 3 — Under Contract (`UNDER_CONTRACT`)
**Conversational questions:**
1. "Earnest money — I'll generate the wire instructions and receipt request. Confirm title company."
2. "Property disclosures — do we have them, or do I chase the listing agent?"
3. "Which inspector? I can book mine, or use yours."
4. "Does the lender already have the executed PA, or should I send it?"

**Data pulls:**
- Vendor model → preferred title company, inspector, lender for this agent
- Party communications log → who's been contacted, last response time

**Auto-docs:**
- Earnest money receipt request to title co
- Disclosure package cover email to listing agent
- Lender package (PA + disclosures + pre-approval)
- Buyer/seller introduction letter

**Auto-deadlines:** (already set at Offer stage) — now actively monitored, morning brief surfaces anything at-risk.

**Auto-messages:**
- Three-way intro email: Agent + Client + Title co
- Three-way intro email: Agent + Client + Lender
- Inspector booking email with property access instructions

**Exit criteria → Inspection:** inspection scheduled deadline entered OR inspection deadline reached (whichever first).

---

### Stage 4 — Inspection (`PENDING_INSPECTION`)
**Conversational questions:**
1. "Inspection's done. Any deal-breakers, or mostly cosmetic?"
2. "Are we asking for repairs, a credit, or walking?" *(if issues)*
3. "What number are we asking for?" *(if credit)*
4. "Should I send the inspection response to the listing agent tonight or wait on you?"

**Data pulls:**
- Comparable repair credits on recent transactions (from CMAAnalysis history)
- Negotiation intel → seller's likely response threshold

**Auto-docs:**
- Inspection Response Addendum (LREC) — repair list OR credit request OR release
- Repair-credit math sheet (sent to client)

**Auto-deadlines:**
- Response due (from contract)
- Re-inspection scheduled (if applicable, +7 days)

**Auto-messages:**
- Response addendum to listing agent via AirSign
- Client update: "Here's what I sent, here's the likely response window"
- If request for credit: lender notification (impacts net cash to close)

**Exit criteria → Appraisal:** inspection response document uploaded OR inspection deadline completed.

---

### Stage 5 — Appraisal (`PENDING_APPRAISAL`)
**Conversational questions:**
1. "Did the appraisal come in at value, low, or high?"
2. "If low — do we renegotiate, pay the gap, or kill the deal?"
3. "Lender okay to proceed without modification?"

**Data pulls:**
- AVM vs. actual appraisal variance
- Historical gap-closure rate from negotiation log

**Auto-docs:**
- Appraisal Addendum (price reduction OR gap agreement) if needed
- Lender notification of any price change

**Auto-deadlines:**
- Appraisal objection deadline (contract default +3 days from receipt)

**Auto-messages:**
- Client plain-English appraisal summary
- Listing agent renegotiation note (if low)
- Lender confirmation (if at-value)

**Exit criteria → Financing:** appraisal document uploaded (auto-advance via `onDocumentUploaded`).

---

### Stage 6 — Financing (`PENDING_FINANCING`)
**Conversational questions:**
1. "Lender said they need anything else from the client? Tax returns, explanation letters, bank statements?"
2. "Commitment letter — in hand, or still pending?"
3. "Any conditions we should worry about — job change, new credit inquiry, anything?"

**Data pulls:**
- Lender response cadence from communication log
- Commitment-letter turnaround baseline (lender-specific)

**Auto-docs:**
- Lender condition chaser email (auto-drafted per outstanding item)
- Commitment-letter receipt logged as Document

**Auto-deadlines:**
- Financing commitment deadline (from contract)
- Clear-to-close target (5 days before closing)

**Auto-messages:**
- Daily lender check-in if commitment deadline < 3 days away
- Client reassurance note with specific timeline
- Title co update: "financing on track, CD expected [date]"

**Exit criteria → Closing:** `clear_to_close` or `commitment_letter` document uploaded (auto-advance).

---

### Stage 7 — Closing (`CLOSING`)
**Conversational questions:**
1. "Closing Disclosure — has the client received it? Needs to be 3 business days before closing."
2. "Walk-through scheduled? Morning of closing or day-before?"
3. "Client bringing certified funds or wiring — wire fraud warning sent?"
4. "Utilities transferred? I can send the list."

**Data pulls:**
- CD delivery timestamp (CFPB 3-day rule)
- Historical walk-through issue rate

**Auto-docs:**
- Walk-through checklist (pre-populated for property type)
- Wire fraud warning letter (required LREC/CFPB)
- Utility transfer list (parish-specific vendors)
- Settlement statement review memo

**Auto-deadlines:**
- CD delivery (closing - 3 business days)
- Walk-through (closing day or -1)
- Final loan docs to title (closing - 2 days)

**Auto-messages:**
- Client closing-day prep email (what to bring, what to expect, wire warning)
- Title co final confirmation
- Listing agent coordination message (keys, garage remotes, mailbox key)

**Exit criteria → Post-Close:** Act of Sale document uploaded.

---

### Stage 8 — Post-Close (`POST_CLOSE`)
**Conversational questions:**
1. "Client happy? Any issues at the table?"
2. "Okay to ask for a Google review now or wait a week?"
3. "Any referrals they mentioned?"

**Data pulls:**
- Review-request response rate for this agent
- Referral-ask timing data

**Auto-docs:**
- 1099 prep sheet (if referral paid)
- Commission disbursement reconciliation
- Testimonial request template (client-personalized)

**Auto-deadlines:**
- Review request send-time (+3 days)
- Referral ask (+14 days)
- Anniversary touch (+365 days → Calendar event)
- Annual market update touch (+180 days)

**Auto-messages:**
- Thank-you note with housewarming gift recommendation
- Review request (Google, Zillow, Facebook)
- Referral ask email
- Year-one anniversary / 5-year nurture drip enrollment

**Exit criteria → done:** 60-day window closes; txn archived but relationship stays live via Contact + content engine.

---

## 3. Integration Points

TCS orchestrates every existing AIRE subsystem. None of it gets rebuilt — it gets **called**.

| Subsystem | File | TCS usage |
|---|---|---|
| **State machine** | [lib/workflow/state-machine.ts](lib/workflow/state-machine.ts) | Add `UNDER_CONTRACT` + `POST_CLOSE` transitions. TCS calls `advanceTransaction` on conversational milestones. |
| **Louisiana rules** | [lib/louisiana-rules-engine.ts](lib/louisiana-rules-engine.ts) | `calculateDeadlines()` for auto-deadlines on every stage entry. |
| **Contract writer** | [lib/contracts/contract-writer.ts](lib/contracts/contract-writer.ts) | Auto-draft PA, addenda, response docs. |
| **Document classifier** | [lib/document-classifier.ts](lib/document-classifier.ts) | Any uploaded doc routes to current stage's expected-doc map. |
| **AirSign** | [app/api/airsign/](app/api/airsign/) | Auto-create envelopes for all signature-required auto-docs. |
| **Compliance** | [app/api/compliance/scan/route.ts](app/api/compliance/scan/route.ts) | Run on stage entry; block advance on HIGH violations. |
| **Morning brief** | [lib/agents/morning-brief/](lib/agents/morning-brief/) | TCS stage + next action becomes the top card per deal. |
| **CMA agent** | [app/api/intelligence/cma/route.ts](app/api/intelligence/cma/route.ts) | Called silently at Intake (listing side) and Offer (buyer side). |
| **Vendor scheduler** | [lib/tc/vendor-scheduler.ts](lib/tc/vendor-scheduler.ts) | Inspector, appraiser, title booking. |
| **Party comms** | [lib/tc/party-communications.ts](lib/tc/party-communications.ts) | All auto-messages route here; templated via stage. |
| **Notifications** | [lib/tc/notifications.ts](lib/tc/notifications.ts) | SMS + email on deadline alerts. |
| **Voice pipeline** | [lib/voice-pipeline.ts](lib/voice-pipeline.ts) | "Hey AIRE, what stage is 123 Main St in?" answers from TCS state. |
| **Self-learning** | [lib/learning/feedback-engine.ts](lib/learning/feedback-engine.ts) | Feedback on auto-drafted messages tunes per-user tone. |

---

## 4. UI Flow — `/aire/tcs/new`

**Single-page conversational walkthrough.** No multi-step form. No stepper. Feels like texting an expert co-agent.

### Layout (desktop)
```
┌──────────────────────────────────────────────────┐
│  Sidebar (Deep Forest)                           │
│  ─────────────                                   │
│  • Dashboard                                     │
│  • Transactions                                  │
│  • TCS ← new                                     │
│  ...                                             │
├──────────────────────────────────────────────────┤
│                                                  │
│   ╔═ STAGE RAIL (sticky top, Cream bg) ══════╗   │
│   ║  ● Intake  ○ Offer  ○ UC  ○ Insp  ...   ║   │
│   ╚═════════════════════════════════════════╝   │
│                                                  │
│   ┌─ Conversation feed (scrolls) ──────────┐    │
│   │                                         │    │
│   │  AIRE: Is this a buyer or a listing?   │    │
│   │                                         │    │
│   │                        [ Buyer ][Listing]   │
│   │                                         │    │
│   │  AIRE: What's the address?             │    │
│   │                                         │    │
│   │                      [__________]      │    │
│   │                                         │    │
│   │  AIRE: (fetching MLS...)               │    │
│   │                                         │    │
│   │  ╔═ Silent Actions ═════════════════╗  │    │
│   │  ║ ✓ Pulled MLS — 1,847 sqft        ║  │    │
│   │  ║ ✓ Tax ID 012-3456-789             ║  │    │
│   │  ║ ✓ Flood zone X (no special disc) ║  │    │
│   │  ║ … CMA running                    ║  │    │
│   │  ╚══════════════════════════════════╝  │    │
│   │                                         │    │
│   └─────────────────────────────────────────┘    │
│                                                  │
│   ┌─ Composer (bottom) ─────────────────────┐    │
│   │  Type or pick a quick answer…       [→]│    │
│   └─────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Design tokens (per DESIGN.md)
- Page bg: `#f5f2ea` Cream
- Sidebar: `#1e2416` Deep Forest
- Conversation feed: `#f0ece2` Warm White cards, Deep Forest text
- Stage rail: Cream with Olive active dot, Sage completed dots
- AIRE bubble: Sage 20%-opacity bg, Playfair italic for the opening of each question, Space Grotesk for body of question
- User bubble: Olive bg, Linen text
- Silent Actions panel: Cream card, Olive left-border, IBM Plex Mono action lines, checkmark in Olive
- Composer input: per DESIGN.md input spec (1.5px Sage border, Olive focus ring)
- Stats in Silent Actions (sqft, tax ID, price): IBM Plex Mono 14px

### Interaction model
1. User lands on `/aire/tcs/new` — first AIRE bubble renders, question + quick-reply chips.
2. User picks chip or types answer.
3. On submit:
   - POST `/api/tcs/answer` with `{ sessionId, stage, questionKey, answer }`.
   - Server calls `lib/tcs/conversation-engine.ts` → Claude decides next question + triggers side-effect tool calls.
   - Response streams back: (a) acknowledgement bubble, (b) silent-action rows, (c) next question.
4. Stage rail auto-advances as server confirms each stage's exit criteria met.
5. "See the deal" button appears once `DRAFT → ACTIVE` transition lands — opens `/aire/transactions/[id]` in a new tab, TCS keeps walking.

### Mobile
- Stage rail becomes horizontal scrollable pill row.
- Conversation feed takes full height minus sticky composer.
- Silent Actions collapse to a "3 actions taken" chip; tap to expand.

---

## 5. Prisma Schema Changes

```prisma
enum TransactionStatus {
  DRAFT
  ACTIVE
  UNDER_CONTRACT      // NEW
  PENDING_INSPECTION
  PENDING_APPRAISAL
  PENDING_FINANCING
  CLOSING
  CLOSED
  POST_CLOSE          // NEW
  CANCELLED
}

// TCS conversation session — one per transaction walkthrough
model TCSSession {
  id              String       @id @default(cuid())
  userId          String
  transactionId   String?      // null until DRAFT row created from intake answers
  transaction     Transaction? @relation(fields: [transactionId], references: [id])

  side            String       // "BUYER" | "LISTING" | "DUAL"
  currentStage    TransactionStatus @default(DRAFT)
  messages        Json         // rolling array { role, content, at, toolCalls? }
  answers         Json         // { questionKey: answer } accumulated
  silentActions   Json         // [{ at, kind, summary, payload }]

  completedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([userId, createdAt])
  @@index([transactionId])
}

// Optional — templated question bank so conversation engine can version prompts per stage
model TCSQuestion {
  id             String  @id @default(cuid())
  stage          TransactionStatus
  key            String  @unique
  promptTemplate String  @db.Text
  quickReplies   Json?   // [{ label, value }]
  required       Boolean @default(true)
  orderHint      Int     @default(0)
}

// Multi-tenant
model Brokerage {
  id             String  @id @default(cuid())
  name           String
  slug           String  @unique
  logoUrl        String?
  primaryContact String?
  billingEmail   String?
  seatCount      Int     @default(1)
  tier           String  @default("STANDARD")  // "STANDARD" | "ENTERPRISE"

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  members        BrokerageMember[]
  teams          Team[]
}

model BrokerageMember {
  id            String    @id @default(cuid())
  brokerageId   String
  brokerage     Brokerage @relation(fields: [brokerageId], references: [id])
  userId        String    @unique
  role          String    // "OWNER" | "BROKER" | "TC" | "AGENT" | "ASSISTANT"
  teamId        String?
  team          Team?     @relation(fields: [teamId], references: [id])
  joinedAt      DateTime  @default(now())

  @@index([brokerageId])
}

model Team {
  id            String    @id @default(cuid())
  brokerageId   String
  brokerage     Brokerage @relation(fields: [brokerageId], references: [id])
  name          String
  leaderUserId  String?

  members       BrokerageMember[]

  @@index([brokerageId])
}

// Add to User:
//   brokerageMembership BrokerageMember?
//
// Add to Transaction:
//   brokerageId   String?
//   teamId        String?
//   assignedTcId  String?   // which TC is watching this deal
```

**Migration order:**
1. Add enum values (`UNDER_CONTRACT`, `POST_CLOSE`) — requires `npx prisma migrate dev --name tcs_new_stages`
2. Create `TCSSession`, `TCSQuestion` — `tcs_session_tables`
3. Create `Brokerage`, `BrokerageMember`, `Team` + link columns — `tcs_multi_tenant`

**Reminder:** kill node processes before `prisma generate` on OneDrive (DLL lock).

---

## 6. 14-Day Build Roadmap

| Day | Work | Deliverable |
|---|---|---|
| **1** | Schema migration + state-machine extension | `TransactionStatus` has UC + PC; TCSSession table live |
| **2** | `lib/tcs/state-machine.ts` (wraps workflow/state-machine with stage-specific auto-advance) | Unit tests pass |
| **3** | `lib/tcs/stage-actions.ts` — stage 1 (Intake) actions: MLS pull, parish lookup, agency disclosure draft | Intake stage end-to-end in dev |
| **4** | `lib/tcs/conversation-engine.ts` — Claude-powered question flow with tool use | Stage 1 conversation works in API |
| **5** | `app/api/tcs/session/route.ts` (POST create, GET read), `answer/route.ts` (POST advance) | Postman flow for intake |
| **6** | `app/aire/tcs/new/page.tsx` shell — layout, stage rail, composer (no data) | UI renders, matches DESIGN.md |
| **7** | Wire UI to API — conversation feed, silent actions panel, quick replies, streaming | Agent completes Intake via UI, txn DRAFT row created |
| **8** | Stage 2 (Offer) actions: LREC PA auto-draft, contingency addenda, AirSign envelope | Can generate + send PA from conversation |
| **9** | Stage 3 (UC) actions: earnest money flow, 3-way intros, vendor scheduling | Full handoff to inspection |
| **10** | Stages 4–5 actions: inspection response, appraisal addenda | Critical path covered |
| **11** | Stages 6–7 actions: financing chaser, CD timeline, walk-through, wire warning | Closing-ready |
| **12** | Stage 8 actions: review ask, referral ask, anniversary drip, commission reconciliation | Full 8-stage loop |
| **13** | Multi-tenant: Brokerage + BrokerageMember + permissions middleware + team routing | Broker can see all agents' deals |
| **14** | Polish: compliance gate on stage advance, morning-brief integration, voice integration ("what stage?"), QA pass with seed data | Demo-ready |

**Definition of Done (day 14):** A first-time agent seeded into a test brokerage completes a mock Baton Rouge transaction from Intake → Post-Close without touching an LREC PDF, without picking a status manually, without drafting a single message. Every artifact (PA, addenda, disclosure, receipt, CD memo, review email) is generated, signed, sent, and logged.

---

## 7. Broker-Tenant Model

**Three roles per brokerage:**

| Role | Scope | Can do |
|---|---|---|
| **OWNER** / **BROKER** | All brokerage txns | View all, reassign, approve compliance flags, see seat billing, configure templates |
| **TC** (Transaction Coordinator) | All txns on assigned teams | Drive stage-actions, approve auto-msgs, chase deadlines, no price-decision authority |
| **AGENT** | Own txns only | Do the conversation walkthrough, approve auto-drafts, override TC if desired |
| **ASSISTANT** | Assigned agent's txns, read-only + message drafting | Pre-fill, but agent approves |

**Permission implementation:**
- Middleware at `/aire/tcs/*` resolves `user.brokerageMembership` → injects `brokerageScope` into all Prisma queries via a helper `scopedTransaction(userId)`.
- Team-level routing: `Transaction.teamId` filters morning brief, dashboards, compliance queues.
- Brokerage-level dashboards at `/aire/brokerage/*` (owner/broker only): pipeline $, agent leaderboard, compliance violation rate, average days-on-market, AirSign throughput.

**Billing model:**
- Brokerage-tier: $97/seat/mo base (Pro features per agent) + $2K/mo platform fee for brokerage-level analytics + $500/mo per TC seat (TC dashboard).
- Enterprise tier ($50K–$100K/mo target): white-label, custom LREC-form branding, dedicated onboarding, SLA, custom data connectors (MLS variants, CRM sync, QuickBooks commission pipe).

**Data isolation:**
- All Prisma queries that traverse `Transaction` MUST include `brokerageId` scope. Enforce via repo helper — no raw `prisma.transaction.findMany` in API routes.
- Documents + AirSign envelopes inherit `brokerageId` from parent transaction for cross-agent visibility within a brokerage.

---

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| Claude hallucinates LREC form field names | All auto-drafts go through `lib/contracts/lrec-fields.ts` schema — strict whitelist, no free-form fields |
| Auto-messages sent prematurely | Every message is drafted to AirSign/Resend as *draft*; agent one-tap approves unless they opt into auto-send per action type |
| Deadline miscalculation | `lib/louisiana-rules-engine.ts` is single source; TCS never reimplements date math |
| Multi-tenant data leak | Repo-helper enforcement + tests that attempt cross-brokerage reads and expect them to 403 |
| Conversational UI feels slow | SSE streaming on `/api/tcs/answer`; silent actions render progressively as tools return |
| Agent abandons mid-flow | TCSSession persists; resume link surfaces in morning brief |

---

## 9. Success Metrics (post-launch)

- **Time to first contract drafted:** < 12 minutes from `/aire/tcs/new` load.
- **Auto-doc acceptance rate:** > 85% (< 15% agent rewrites).
- **Deadline miss rate:** < 2% per transaction (industry avg ~11%).
- **Agent NPS after first TCS-guided close:** > 60.
- **Brokerage retention after month 3:** > 90%.

---

**This plan is grounded in the 45+ systems already built in [CLAUDE.md](CLAUDE.md) (TC CRUD, AirSign, LREC writer, Louisiana rules, morning brief, document classifier, compliance scanner, voice pipeline, self-learning). TCS is the orchestration layer — not a rebuild. That's why 14 days is realistic.**

PLAN READY — awaiting 'ship it'
