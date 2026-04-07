# AGENT 2 MISSION: TC Assistant — Dummy-Proof Transaction Coordinator
**Priority:** HIGH — This is the core product. Agents live and die by their transactions.
**Goal:** A real estate agent who knows NOTHING about technology can manage their entire deal pipeline from this dashboard. Every step is obvious. Every action is one click. The system does the thinking.

---

## CONTEXT — READ BEFORE DOING ANYTHING

You are working in: `c:\Users\cjjfr\OneDrive\AIRE ALL FILES\aire-assistant\`
Stack: Next.js 14, Prisma, Neon PostgreSQL, Clerk auth, Vercel

### What Already Exists (DO NOT REBUILD)
- `app/aire/transactions/page.tsx` — Transaction list (search, filter, sort)
- `app/aire/transactions/new/page.tsx` — Create transaction form (not yet built — check if exists)
- `app/aire/transactions/[id]/page.tsx` — Transaction detail (5 tabs)
- `components/tc/TransactionDetail.tsx` — Detail component
- `components/tc/TransactionTimeline.tsx` — Visual timeline
- `app/api/transactions/route.ts` — CRUD (POST to create, GET to list)
- `app/api/transactions/[id]/route.ts` — GET/PATCH/DELETE single transaction
- `app/api/transactions/[id]/deadlines/route.ts` — Deadline management
- `lib/tc/party-communications.ts` — 10 email templates for parties
- `lib/tc/vendor-scheduler.ts` — Vendor coordination
- `lib/tc/notifications.ts` — Email + SMS notification system
- `lib/tc/morning-brief.ts` — TC-specific morning brief
- `lib/workflow/state-machine.ts` — Workflow automation
- `app/api/cron/tc-reminders/route.ts` — Daily reminder cron

### What's Broken / Missing
1. Transaction creation form may not exist or may be incomplete
2. No "quick start" flow — agent has to know what fields to fill
3. No contextual help or tooltips explaining what each field means
4. Deadline tab works but doesn't explain WHY a deadline matters
5. Communications tab needs RESEND_API_KEY for real emails
6. Documents tab has no upload button
7. No deal progress percentage or visual pipeline stage indicator
8. No automated nudges ("You haven't uploaded the inspection report — it's due in 3 days")

---

## YOUR MISSION — 5 PHASES

### PHASE 1: AUDIT + FIX EXISTING FLOWS
**Time estimate: 1 hour**

1. Start dev server, log in, navigate every TC page:
   - `/aire/transactions` — list loads? search works? filters work?
   - `/aire/transactions/new` — does this page exist? Can you create a deal?
   - `/aire/transactions/[id]` — all 5 tabs render? real data shows?
2. Create a test transaction via the UI (if form exists) or via API:
   ```
   POST /api/transactions
   {
     "propertyAddress": "456 Test Blvd",
     "propertyCity": "Baton Rouge",
     "propertyState": "LA",
     "propertyZip": "70808",
     "listPrice": 250000,
     "offerPrice": 240000,
     "buyerName": "Test Buyer",
     "sellerName": "Test Seller",
     "status": "UNDER_CONTRACT",
     "closingDate": "2026-05-15"
   }
   ```
3. Verify the transaction appears in the list
4. Click into it — verify all 5 tabs show data
5. Mark a deadline as complete — verify it updates
6. Fix ANY broken UI elements you find (missing data, errors, blank tabs)

**DONE WHEN:** Can create, view, update, and manage a transaction end-to-end.

### PHASE 2: DUMMY-PROOF THE CREATE FLOW
**Time estimate: 2 hours**

The create transaction form must be so simple that an agent who's never used a computer could figure it out. Build or redesign `/aire/transactions/new`:

**Required Fields (with helper text):**
```
DEAL BASICS
- Property Address* — "Full address of the property (e.g., 123 Main St)"
- City* — "City name" (default: "Baton Rouge")
- State* — "State" (default: "LA", dropdown)
- ZIP* — "ZIP code"
- Parish — "Louisiana parish" (dropdown: East Baton Rouge, Ascension, Livingston, etc.)
- MLS Number — "MLS listing number (optional)"

DEAL TERMS
- List Price* — "Original listing price"
- Offer Price* — "Accepted offer amount"
- Earnest Money — "Earnest money deposit amount"
- Financing Type — Dropdown: Conventional, FHA, VA, USDA, Cash, Seller Finance
- Closing Date* — Date picker

PARTIES
- Buyer Name* — "Full legal name of buyer(s)"
- Buyer Email — "Buyer's email address"
- Buyer Phone — "Buyer's phone number"
- Seller Name* — "Full legal name of seller(s)"
- Seller Email — "Seller's email address"  
- Seller Phone — "Seller's phone number"
- Buyer's Agent — "Name of buyer's agent (if not you)"
- Seller's Agent — "Name of seller's agent (if not you)"
- Title Company — "Title company name"
- Lender — "Lender name and loan officer"

YOUR ROLE
- Side — Radio: "I represent the Buyer" / "I represent the Seller" / "Dual Agency"
```

**UX Requirements:**
- Multi-step form (3 steps: Basics → Terms → Parties) with progress indicator
- Large input fields, clear labels, placeholder examples in EVERY field
- "Quick Create" option at top: just address + buyer + seller + price + closing date (5 fields, everything else optional)
- Validation with friendly error messages ("Please enter the property address")
- On submit: auto-calculate deadlines based on Louisiana rules:
  - Inspection deadline: closing date - 14 days
  - Financing deadline: closing date - 21 days  
  - Appraisal deadline: closing date - 10 days
  - Title deadline: closing date - 7 days
  - Walk-through: closing date - 1 day
- Redirect to transaction detail after creation

**DONE WHEN:** Agent can create a full transaction in under 2 minutes with zero confusion.

### PHASE 3: DEAL DASHBOARD — THE COMMAND CENTER
**Time estimate: 2 hours**

Redesign the transaction detail page to be a COMMAND CENTER for the deal. When an agent opens a deal, they should immediately know:

**Header Bar (always visible):**
```
[456 Test Blvd, Baton Rouge, LA 70808]
[UNDER CONTRACT] [Day 12 of 45] [73% Complete]
[Buyer: Test Buyer] [Seller: Test Seller]
[Closing: May 15, 2026 — 41 days away]
```

**Deal Progress Bar:**
Visual pipeline: `Contract → Inspection → Appraisal → Financing → Title → Closing`
Show which stage the deal is in. Color-code: green (done), yellow (in progress), gray (upcoming), red (overdue).

**Smart Action Cards (Top of Page):**
Instead of tabs, show ACTION CARDS based on what needs attention RIGHT NOW:

```
[!] URGENT: Inspection deadline in 3 days — no inspection report uploaded
    → [Upload Report] [Mark Complete] [Extend Deadline]

[i] UPCOMING: Appraisal ordered, estimated completion April 12
    → [Check Status] [Contact Appraiser]

[✓] DONE: Earnest money deposited on March 28
```

These cards auto-generate based on:
- Upcoming deadlines (next 7 days)
- Missing documents for current stage
- Unanswered communications
- Overdue items (RED, top of list)

**Keep the 5 tabs below the action cards** for detailed views:
- Overview: deal info, all parties, financials
- Deadlines: grouped by urgency, complete buttons
- Documents: uploaded docs with extracted data, upload button
- Communications: sent/received messages, quick-send templates
- Contracts: generated contracts, AirSign status

**DONE WHEN:** Agent opens a deal and immediately knows what to do next without thinking.

### PHASE 4: AUTOMATED NUDGES + SMART NOTIFICATIONS
**Time estimate: 1.5 hours**

The system should TELL the agent what to do, not wait for them to figure it out.

**In-App Notifications:**
1. Create a notification banner/toast system (or use existing if one exists)
2. Trigger notifications for:
   - Deadline approaching (7 days, 3 days, 1 day, overdue)
   - Document missing for current deal stage
   - Party hasn't responded in 48 hours
   - New document uploaded by another party
   - AirSign envelope completed
   - Compliance issue detected

**Dashboard Alerts (`/aire` main page):**
- "You have 3 deals with action items today"
- "2 deadlines this week"
- "1 document awaiting your signature"

**Smart Suggestions (on transaction detail):**
Based on deal stage, suggest next actions:
- After contract signed → "Upload earnest money receipt"
- After inspection → "Review inspection report and respond"
- After appraisal → "Check if appraisal meets contract price"
- 7 days before closing → "Confirm title clear, schedule walk-through"

**Implementation:**
- Create `lib/tc/smart-suggestions.ts` — function that takes a transaction + its deadlines/documents and returns prioritized action items
- Wire into transaction detail page header
- Wire into main dashboard
- Wire into morning brief

**DONE WHEN:** Agent gets clear, prioritized action items without asking.

### PHASE 5: COMMUNICATION TEMPLATES + ONE-CLICK ACTIONS
**Time estimate: 1.5 hours**

Make every communication ONE CLICK:

**Quick-Send Templates (already partially exist):**
Verify and enhance these templates in the Communications tab:

1. **Offer Accepted** → sends to buyer, seller, both agents, title company, lender
2. **Inspection Scheduled** → sends to buyer + buyer's agent with date/time
3. **Inspection Complete** → sends to all parties with summary
4. **Repair Request** → sends to seller + seller's agent
5. **Appraisal Ordered** → sends to lender + buyer
6. **Appraisal Complete** → sends to all parties with value
7. **Clear to Close** → sends to all parties + title company
8. **Closing Scheduled** → sends to all parties with date/time/location
9. **Deal Update** → custom message to selected parties
10. **Deadline Reminder** → sends to responsible party

**Each template should:**
- Auto-fill: property address, party names, dates, amounts from transaction data
- Show preview before sending
- Let agent edit before sending
- Log to communications history
- Work with email (Resend) with SMS fallback (Twilio) with console.log fallback

**One-Click Actions in Transaction Detail:**
- "Schedule Inspection" → opens vendor scheduler with pre-filled property
- "Order Appraisal" → sends request to lender
- "Send to Title" → sends contract package to title company
- "Request Extension" → generates addendum for deadline extension
- "Upload & Send" → upload document + auto-send to relevant parties

**DONE WHEN:** Agent can manage all deal communications without leaving the app.

---

## SUCCESS CRITERIA — HOW CALEB WILL TEST

Caleb will pretend to be a brand new agent who just got a deal under contract:

1. Go to `/aire/transactions/new`
2. Use "Quick Create" with just: address, buyer, seller, price, closing date
3. Transaction creates with auto-calculated deadlines
4. Deal detail shows progress bar at "Contract" stage
5. Action cards show: "Upload earnest money receipt" + "Schedule inspection"
6. Click through each tab — all show real data
7. Send an "Offer Accepted" communication to all parties
8. Mark inspection deadline as complete
9. Progress bar advances
10. Dashboard shows the deal with correct status

If an agent can do steps 1-10 without asking "what do I do next?" → TC is DONE.

---

## RULES
- DO NOT rebuild the API routes — they work. Focus on the UI and UX.
- DO NOT change database schema without documenting in SHARED_CHANGES.md.
- Every piece of text visible to the user must be plain English. No developer jargon.
- Buttons must say what they DO: "Upload Inspection Report" not "Upload Document".
- Colors follow brand palette: Sage #9aab7e, Olive #6b7d52, Cream #f5f2ea, Linen #e8e4d8, Deep Forest #1e2416.
- Fonts: Playfair Display for headings, Space Grotesk for body, IBM Plex Mono for data.
- If you hit a blocker, write it to `AGENT_MISSIONS/BLOCKERS.md`.
- If you modify shared files, document in `AGENT_MISSIONS/SHARED_CHANGES.md`.
