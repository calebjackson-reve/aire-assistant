# AIRE Agent Specifications

Detailed specs for each of the 7 AIRE agents. Each spec covers the agent's role, triggers,
data sources, processing logic, output format, and approval requirements.

---

## Agent 1 — Transaction Agent

**Role**: The backbone of AIRE. Manages the full deal lifecycle from offer to close.

**Triggers**:
- New transaction created in database
- Voice command routed to transaction context
- Document uploaded or signed
- Deadline approaching (configurable threshold, default 48h)
- Status change on any transaction field

**Input Sources**:
- `transactions` table (Prisma)
- `documents` table (contracts, amendments, disclosures)
- `voice_commands` table (commands classified as transaction-related)
- Dotloop API (document status, signature status)
- Paragon MLS API (listing status changes)

**Core Capabilities**:
- Track deal milestones: offer → acceptance → inspection → appraisal → clear to close → closing
- Monitor document completeness — flag missing required docs
- Enforce deadline compliance — alert agent X hours before critical dates
- Generate transaction summaries on demand
- Route voice commands to correct transaction file using context matching
- Coordinate with title company, lender, inspector via status tracking

**Output Schema**:
```typescript
interface TransactionAgentOutput {
  transactionId: string;
  action: 'status_update' | 'deadline_alert' | 'document_request' | 'summary' | 'task_created';
  summary: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  suggestedActions: Array<{
    label: string;
    actionType: string;
    payload: Record<string, any>;
  }>;
}
```

**Approval Gate**: Required for any client-facing communication, document submission, or
status change that triggers external notifications.

**Louisiana-Specific Logic**:
- Tracks mineral rights exclusion status on every property
- Monitors flood zone classification and insurance requirements
- Understands parish-level recording requirements and fees
- Enforces LREC-mandated disclosure timelines

---

## Agent 2 — Voice Command Agent

**Role**: AIRE's defining feature. Converts spoken commands into executed actions.

**Triggers**:
- User presses voice button in AIRE UI (VoiceCommandBar component)
- Audio transcription received via Web Speech API

**Pipeline**:
```
Audio → Web Speech API transcription → /api/voice-command route
→ Claude intent classification → Entity extraction → Transaction matching
→ Action routing → Approval (if needed) → Execution → Response
```

**Intent Categories**:
- `draft_addendum` — Generate contract addendum
- `generate_cma` — Create comparative market analysis
- `transaction_summary` — Summarize deal status
- `schedule_action` — Schedule showing, inspection, closing
- `send_update` — Draft client/agent update
- `document_status` — Check document/signature status
- `general_query` — Real estate question or market info

**Disambiguation Logic**:
When the agent says something ambiguous like "that addendum" or "the Seyburn file",
the Voice Command Agent resolves it using:
1. Active transaction context (most recently viewed)
2. Recency scoring across all transactions
3. Proper noun matching against transaction/client names
4. Conversation context window (last 5 commands)

**Target Performance**: Spoken command → completed action in under 8 seconds.

**Approval Gate**: Required for any document generation, email sending, or contract modification.
NOT required for status queries or summaries (read-only operations).

---

## Agent 3 — Email Scan Agent

**Role**: Continuously monitors the agent's inbox, classifies emails by type and urgency,
extracts action items, and routes them to the correct transaction.

**Triggers**:
- Cron job (configurable, default every 15 minutes during business hours)
- Manual scan request from agent

**Input Sources**:
- Gmail API (OAuth authenticated)
- `transactions` table (for matching emails to deals)
- `email_scan_log` table (to avoid re-processing)

**Classification Categories**:
- `client_question` — Requires response
- `lender_update` — Loan status, conditions, approvals
- `title_update` — Title search, commitment, closing schedule
- `inspection_report` — Inspection results, repair requests
- `contract_action` — Signature needed, amendment received
- `marketing_lead` — New lead or inquiry
- `informational` — Newsletter, announcement, no action needed

**Output Schema**:
```typescript
interface EmailScanResult {
  emailId: string;
  from: string;
  subject: string;
  classification: EmailCategory;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  matchedTransactionId: string | null;
  extractedActions: string[];
  suggestedResponse: string | null;
  requiresAgentReview: boolean;
}
```

**Approval Gate**: Required before any auto-response is sent. Email scan results are
surfaced in the Morning Brief and Transaction Dashboard for review.

---

## Agent 4 — Morning Brief Agent

**Role**: Synthesizes overnight activity across all agents into a single ranked daily
action list. This is what the agent sees first thing every morning.

**Triggers**:
- Cron job at configured time (default 6:00 AM CT)
- Manual request ("give me my morning brief")

**Input Sources**:
- Email Scan Agent results (overnight emails)
- Transaction Agent (deadline proximity scores, status changes)
- Voice Command Agent (pending commands, incomplete actions)
- Calendar API (today's appointments)
- MLS changes (new listings, price changes, status changes on watched properties)

**Synthesis Logic**:
The Morning Brief ranks items by a composite urgency score:
```
urgency_score = (deadline_proximity * 0.4) + (client_impact * 0.3) + (revenue_risk * 0.2) + (compliance_risk * 0.1)
```

**Output**: A structured brief with:
1. Critical items requiring immediate action (top 3)
2. Today's appointments with context pulled from transactions
3. Pending approvals from overnight agent activity
4. Market alerts (new comps, price changes in active deal neighborhoods)
5. One-tap action buttons embedded in each item

**Approval Gate**: The brief itself doesn't need approval — it's informational.
But actions taken FROM the brief (responding to emails, approving documents) route
through their respective agent approval gates.

---

## Agent 5 — Content Agent

**Role**: Generates all marketing and client-facing content — listing descriptions,
social media posts, market reports, email campaigns, and branded materials.

**Triggers**:
- New listing entered in MLS (auto-generate description)
- Scheduled content calendar items
- Manual request ("write a post about the Baton Rouge market")
- Market data threshold crossed (trigger market update)

**Input Sources**:
- Paragon MLS data (property details, photos, features)
- PropStream data (neighborhood stats, trends)
- Brand guidelines and tone settings
- Content calendar (stored in database)

**Content Types**:
- Listing descriptions (MLS-ready, with Louisiana-specific terminology)
- Social media posts (Instagram, Facebook — formatted per platform)
- Market reports (weekly/monthly Baton Rouge market analysis)
- Email newsletters (market updates, new listings, sold announcements)
- Blog posts for aireintel.org

**Brand Voice**: Strategic, elite, data-driven, Baton Rouge authority. Never generic
national real estate copy. Always reference local neighborhoods, parishes, and market
dynamics specific to the Baton Rouge metro.

**Approval Gate**: Required for ALL content before publishing. The agent reviews and
can edit before any content goes live.

---

## Agent 6 — Intelligence Agent

**Role**: AIRE's analytical engine. Generates CMAs, market analyses, deal scores,
and investment calculations.

**Triggers**:
- CMA request (voice command, manual, or automated for new listing)
- Weekly market report generation
- Deal score calculation when new transaction is created
- Comp alert when relevant properties sell near an active listing

**Input Sources**:
- Paragon MLS API (comparable sales, active listings, days on market)
- PropStream API (property history, tax records, ownership)
- Flood zone data (FEMA, parish records)
- `transactions` table (for deal scoring context)

**CMA Generation Pipeline**:
```
Address input → Pull subject property data → Select comparable sales
→ Apply Louisiana-specific adjustments (flood zone, mineral rights, parish tax)
→ Calculate adjusted values → Generate branded CMA document
```

**Louisiana-Specific Weighting**:
- Flood zone match: weighted heavily (Zone AE vs Zone X can be 10-15% value delta)
- Mineral rights status: included/excluded affects value
- Parish tax rates: vary significantly across EBR, WBR, Livingston, Ascension
- Lot size relative to subdivision norm (Louisiana lots vary more than typical)

**Approval Gate**: CMA outputs require agent review before sharing with clients.
Market reports published to aireintel.org require review.

---

## Agent 7 — Compliance Agent

**Role**: The safety net. Monitors all agent activity and transaction data for
LREC compliance violations, missing disclosures, and regulatory risks.

**Triggers**:
- Continuous monitoring of transaction status changes
- Document upload or modification
- Before any client-facing action is approved
- Weekly compliance audit (cron)

**Checks Performed**:
- Required disclosure timelines (Louisiana-specific)
- License expiration monitoring for agent and brokerage
- Dual agency disclosure requirements
- Property condition disclosure completeness
- Lead paint disclosure for pre-1978 properties
- Flood zone disclosure requirements
- Mineral rights disclosure status
- Commission disclosure compliance

**Output Schema**:
```typescript
interface ComplianceCheckResult {
  transactionId: string;
  checkType: string;
  status: 'compliant' | 'warning' | 'violation';
  description: string;
  requiredAction: string | null;
  deadline: Date | null;
  lrecReference: string; // Specific LREC rule citation
}
```

**Approval Gate**: Compliance violations block the approval of the triggering action
until the agent acknowledges and resolves the issue. This is non-negotiable — the
Compliance Agent has veto power over other agents' outputs.
