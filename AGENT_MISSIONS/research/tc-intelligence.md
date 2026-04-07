# Transaction Coordinator — Competitive Intelligence
*Agent 4 Research — 2026-04-04*

## Platform Analysis

### DotLoop (Transaction Management)
**Source:** https://www.dotloop.com/features/

**Transaction Management Features:**
1. **Loop (Transaction Room)** — Single workspace per deal: docs, tasks, contacts, timeline, activity.
2. **Task templates** — Pre-built task lists for each transaction type (listing, buyer, rental, commercial).
3. **Document checklists** — Required documents per transaction type with completion tracking.
4. **Activity feed** — Every action logged: who viewed, signed, uploaded, commented, and when.
5. **Broker oversight** — Manager dashboard showing all agents' pipelines, compliance status, overdue items.
6. **Client portal** — Clients see their transaction status without needing the full app.
7. **Pipeline view** — Visual pipeline (Pre-Listing → Active → Under Contract → Closing → Closed).

**What We Should Adopt:**
- Task templates by transaction type → **HIGH** (pre-populate deadlines by deal type)
- Document checklists → **HIGH** (show which docs are missing vs uploaded)
- Client portal → **MEDIUM** (read-only transaction view for buyers/sellers)
- Pipeline view → We have this ✓ (transaction list with status filter)

---

### SkySlope
**Source:** https://www.skyslope.com/

**Key Features:**
1. **Compliance dashboard** — Broker sees all transactions with compliance score. Red/yellow/green.
2. **Document review workflow** — Agent uploads → reviewer checks → approved/rejected with notes.
3. **DigiSign** — Built-in e-signatures (basic compared to DocuSign).
4. **Audit trail** — Complete document access log for regulatory audits.
5. **Automated reminders** — Sends agent reminders for missing documents or approaching deadlines.
6. **MLS integration** — Auto-creates transaction from MLS listing data.

**What We Should Adopt:**
- Compliance score per transaction → **HIGH** (we have compliance scanner, just need a per-deal score)
- Document review workflow → **MEDIUM** (agent uploads, system reviews, flags issues)
- Automated deadline reminders → **HIGH** (we have deadlines but no auto-reminders)

---

### Brokermint
**Source:** https://www.brokermint.com/

**Back-Office Features:**
1. **Commission tracking** — Calculate agent commission per deal, including splits and caps.
2. **Commission plans** — Define different commission structures (flat, graduated, team splits).
3. **Agent onboarding** — Digital onboarding for new agents joining the brokerage.
4. **Reporting** — GCI, volume, transaction count, avg price by agent/office/period.
5. **QuickBooks integration** — Sync commission payments to accounting.

**Relevance to AIRE:** Low priority for v1. Commission tracking would be valuable for AIRE Pro/Investor users managing multiple agents or investment properties.

---

## Open Source Findings

### Task/Deadline Management

| Library | Stars | License | What It Does | Relevance |
|---------|-------|---------|-------------|-----------|
| **Bull/BullMQ** | 15K+ | MIT | Redis-based job queue with scheduling | Deadline reminders, cron-like scheduling |
| **node-cron** | 3K+ | MIT | In-process cron scheduling | Already using Vercel crons, lower priority |
| **agenda** | 9K+ | MIT | MongoDB-backed job scheduling | Alternative to BullMQ |

### Notification Systems

| Library | Stars | License | What It Does |
|---------|-------|---------|-------------|
| **react-email** | 14K+ | MIT | Beautiful email templates in React/TSX |
| **@react-email/components** | Part of react-email | MIT | Pre-built email components |
| **mjml** | 16K+ | MIT | Email framework → responsive HTML |
| **novu** | 35K+ | MIT | Full notification infrastructure (email, SMS, push, in-app) |

### Pipeline/Workflow

| Library | Stars | License | What It Does |
|---------|-------|---------|-------------|
| **xstate** | 27K+ | MIT | State machine library for complex workflows |
| **robot** | 2K+ | MIT | Lightweight state machine |
| **inngest** | 5K+ | Apache 2.0 | Event-driven serverless workflow engine |

**Note:** We already have `lib/workflow/state-machine.ts` — no need to replace with xstate unless complexity grows.

---

## UX Patterns We Should Implement

### 1. Transaction Type Templates
Pre-populate deadlines and document checklists based on transaction type:

| Type | Default Deadlines | Required Documents |
|------|------------------|-------------------|
| **Residential Purchase (Buyer)** | Inspection (14d), Financing (30d), Closing (45d) | Purchase Agreement, Pre-Approval, Inspection Report, Appraisal, Title, Survey, Insurance, Closing Disclosure |
| **Residential Purchase (Seller)** | Disclosure (3d), Inspection Response (14d), Closing (45d) | Property Disclosure, Agency Disclosure, Lead Paint (pre-1978), Termite Report |
| **Listing** | Photos (7d), MLS Entry (3d), First Open House (14d) | Listing Agreement, Property Disclosure, Agency Disclosure |
| **Lease** | Application Review (3d), Lease Signing (7d), Move-In (30d) | Lease Agreement, Application, Background Check |

### 2. Document Completeness Score
For each transaction, show: `7/12 documents uploaded (58%)`
- Green: 80%+ complete
- Yellow: 50-79% complete
- Red: < 50% complete
- Show which specific documents are missing

### 3. Smart Notifications Schedule
| Trigger | When | Channel |
|---------|------|---------|
| Deadline approaching | 7 days, 3 days, 1 day, day-of | Email + in-app |
| Document missing | Daily after 50% of closing timeline | Email |
| Compliance issue detected | Immediately | Email + in-app |
| Transaction status change | Immediately | In-app |
| Morning brief ready | 7:00 AM CT daily | Email |

### 4. Client-Facing Transaction Portal
Read-only view for buyers/sellers showing:
- Transaction status and timeline
- Upcoming deadlines
- Documents they need to sign
- Their agent's contact info
- No login required (token-based access like AirSign)

---

## Priority Feature Ranking

| Rank | Feature | Impact | Effort | What To Do |
|------|---------|--------|--------|-----------|
| 1 | Automated deadline reminders | 10 | 3 | Send email/SMS at 7/3/1/0 days before |
| 2 | Document completeness tracking | 9 | 2 | Show missing docs per transaction type |
| 3 | Transaction type templates | 8 | 3 | Pre-populate deadlines + required docs |
| 4 | Compliance score per transaction | 8 | 2 | Run scanner, show red/yellow/green badge |
| 5 | react-email templates | 7 | 3 | Beautiful branded email notifications |
| 6 | Deal analysis on close | 7 | 1 | Already built in deal-analyzer.ts |
| 7 | Activity feed in transaction detail | 6 | 3 | Log all actions in timeline format |
| 8 | Client portal (read-only) | 7 | 5 | Token-based access for buyers/sellers |
| 9 | Commission tracking | 5 | 4 | Per-deal commission calculation |
| 10 | Pipeline analytics | 6 | 3 | Charts: volume by month, avg DOM, conversion |
