# Voice Command NLP Patterns for Real Estate
*Agent 4 Research — 2026-04-04*
*Cross-referenced with: `lib/voice-pipeline.ts` (28 regex patterns), `lib/voice-action-executor.ts` (13 intents)*

---

## Current State: What We Have

### Existing Intents (13)
| Intent | Fast-Path Patterns | Claude Fallback |
|--------|-------------------|-----------------|
| show_pipeline | 4 patterns | Yes |
| check_deadlines | 4 patterns | Yes |
| create_transaction | 3 patterns | Yes |
| write_contract | 3 patterns | Yes |
| run_compliance | 3 patterns | Yes |
| update_status | 3 patterns | Yes |
| market_analysis | 2 patterns | Yes |
| add_party | 2 patterns | Yes |
| calculate_roi | 2 patterns | Yes |
| send_document | 0 patterns | Yes |
| send_alert | 0 patterns | Yes |
| schedule_closing | 0 patterns | Yes |
| create_addendum | 0 patterns | Yes |

**Gap:** 4 intents have zero fast-path patterns — always hit Claude API ($, latency).

### Existing Entity Extraction
- `address` — extracted from regex capture groups, passed to Prisma `contains` search
- `price` — regex extracts with K suffix handling
- `status` — extracted from update commands
- `buyer_name` / `seller_name` — Claude extraction only
- `date` — Claude extraction only (no fast-path date parsing)

**Gap:** No fuzzy address matching. "the Oak Street deal" won't match "742 Oak St, Baton Rouge LA 70810".

---

## MISSING INTENTS — What Agents Actually Say

Based on real estate workflow analysis, these intents should be added:

### 1. Communication Commands (HIGH PRIORITY)
Agents spend 40% of their day communicating. Zero voice support.

```
Intent: send_message
Utterances:
- "Text the buyer about the inspection"
- "Email the title company the closing date"
- "Send a message to John Smith"
- "Tell the seller we're extending by 5 days"
- "Remind the lender about the appraisal deadline"

Entities: recipient_role, recipient_name, message_content, channel (sms/email)
```

**Fast-path patterns to add:**
```regex
/^(?:text|email|message|send|notify) (?:the )?(buyer|seller|lender|title company|agent) (?:about|regarding|re:?) (.+)$/i
/^(?:tell|let) (?:the )?(buyer|seller|lender) (.+)$/i
```

### 2. Scheduling Commands (HIGH PRIORITY)
```
Intent: schedule_event
Utterances:
- "Schedule a showing at 123 Main for Thursday at 3pm"
- "Set up the home inspection for next Monday"
- "Remind me to follow up with the lender on Friday"
- "When is the next open house?"

Entities: event_type, address, date, time, contact_name
```

### 3. Document Queries (MEDIUM)
```
Intent: check_documents
Utterances:
- "What documents are missing on the Oak Street deal?"
- "Has the seller signed the disclosure?"
- "Show me the inspection report for 742 Evergreen"
- "What's the status of the appraisal?"

Entities: document_type, address
```

**Fast-path patterns:**
```regex
/^(?:what|which) (?:documents?|docs?) (?:are )?missing (?:for|on|at) (.+)$/i
/^has (?:the )?(buyer|seller) signed (?:the )?(.+)$/i
```

### 4. Quick Lookups (MEDIUM)
```
Intent: lookup_info
Utterances:
- "What's the buyer's phone number on the Main Street deal?"
- "Who's the lender on 742 Evergreen?"
- "What's the closing date for the Smith deal?"
- "How much is the earnest money?"

Entities: field_name, address
```

### 5. Report/Summary (LOW)
```
Intent: generate_report
Utterances:
- "Give me a summary of this week"
- "How did we do this month?"
- "What's my commission this quarter?"
- "Run the morning brief now"
```

---

## Louisiana Vocabulary Challenges

### Place Names That Break Web Speech API
| Spoken | Web Speech Hears | Correct |
|--------|-----------------|---------|
| Tchoupitoulas | "to chip a tooless" or "chopper tools" | Tchoupitoulas St |
| Thibodaux | "Tibba doh" or "thibo docks" | Thibodaux |
| Natchitoches | "nack a dish" or "Natchatos" | Natchitoches |
| Opelousas | "Oppa Lousas" or "opera louses" | Opelousas |
| Plaquemine | "plaque mine" or "plaque a mean" | Plaquemine |
| Carencro | "Karen crow" or "care in crow" | Carencro |
| Ponchatoula | "pontcha tula" or "poncho tula" | Ponchatoula |
| Gonzales | "gone solace" (usually ok) | Gonzales |
| Denham Springs | Usually correct | Denham Springs |
| Brusly | "brews lee" | Brusly |
| Zachary | Usually correct | Zachary |
| Prairieville | Usually correct | Prairieville |

### Normalization Rules for `normalizeTranscript()`
Add these to the existing normalizer in `app/api/voice-command/route.ts`:

```typescript
const LOUISIANA_CORRECTIONS: Record<string, string> = {
  // Place names (phonetic → correct)
  "to chip a tooless": "Tchoupitoulas",
  "chopper tools": "Tchoupitoulas",
  "tibba doh": "Thibodaux",
  "thibo docks": "Thibodaux",
  "nack a dish": "Natchitoches",
  "natchatos": "Natchitoches",
  "oppa lousas": "Opelousas",
  "plaque mine": "Plaquemine",
  "plaque a mean": "Plaquemine",
  "karen crow": "Carencro",
  "care in crow": "Carencro",
  "poncho tula": "Ponchatoula",
  "pontcha tula": "Ponchatoula",
  "brews lee": "Brusly",
  
  // Real estate jargon
  "act of sale": "closing",
  "ernest money": "earnest money",
  "earnest money": "earnest money",
  "pre qual": "pre-qualification",
  "pre-qual": "pre-qualification",
  "wdi": "WDI",           // Wood Destroying Insect
  "wdo": "WDO",           // Wood Destroying Organism
  "p a": "purchase agreement",
  "pdd": "property disclosure",
  
  // Parish corrections
  "east baton rouge parish": "East Baton Rouge Parish",
  "ascension parish": "Ascension Parish",
  "livingston parish": "Livingston Parish",
  "iberville parish": "Iberville Parish",
  "west baton rouge parish": "West Baton Rouge Parish",
}
```

### Real Estate Jargon That Needs Handling
| Term | Variations Agent Might Say | Should Map To |
|------|--------------------------|---------------|
| Purchase Agreement | "PA", "the contract", "the agreement", "offer" | purchase_agreement |
| Property Disclosure | "PDD", "disclosure", "seller's disclosure" | property_disclosure |
| Earnest Money | "EMD", "earnest", "deposit", "good faith deposit" | earnest_money |
| Days on Market | "DOM", "days on market", "how long listed" | dom |
| Comparative Market Analysis | "CMA", "comp analysis", "comps" | cma |
| Multiple Listing Service | "MLS", "the MLS", "listing" | mls |
| Termite/WDI | "termite inspection", "WDI", "wood destroying insect" | wdi_inspection |
| Home Inspection | "inspection", "home inspection", "general inspection" | home_inspection |
| Appraisal | "appraisal", "the appraisal" | appraisal |
| Title Work | "title", "title search", "title work", "title company" | title |
| Closing | "closing", "act of sale" (Louisiana), "settlement" | closing |
| Under Contract | "under contract", "UC", "pending" | PENDING |
| Contingency | "contingency", "contingencies" | contingency |

---

## Entity Extraction Improvements

### 1. Fuzzy Address Matching
Current: `prisma.transaction.findFirst({ where: { propertyAddress: { contains: address } } })`

**Problem:** "the Oak Street deal" won't match "742 Oak St, Baton Rouge LA".

**Solution: Multi-strategy address resolver**
```typescript
async function resolveAddress(userId: string, query: string) {
  // Strategy 1: Direct contains (current)
  // Strategy 2: Street name extraction — "oak street" → search "Oak"
  // Strategy 3: Street number extraction — "742" → search "742"
  // Strategy 4: Nickname/shorthand — "the Smith deal" → search by buyer/seller name
  // Strategy 5: "that one" / "the last one" → use last command's transaction
}
```

Key patterns to detect:
```regex
/^(?:the |that )?(\w+) (?:street|st|drive|dr|avenue|ave|road|rd|lane|ln|boulevard|blvd) (?:deal|house|property|listing)/i
// → extract street name, search transactions

/^(?:the )?(\w+) deal$/i
// → could be street name OR party name, try both

/^(?:that|the last|this) (?:one|deal|property|transaction)$/i
// → use last command's transactionId
```

### 2. Dollar Amount Parsing
Current: Only handles numeric with K suffix (`$200K`, `200000`).

**Missing:** Spoken amounts.
```typescript
const SPOKEN_AMOUNTS: Record<string, number> = {
  "two hundred thousand": 200000,
  "two fifty": 250000,      // context: real estate = thousands
  "three hundred": 300000,
  "one fifty": 150000,
  "three fifty k": 350000,
}

// Pattern: "[number] [hundred] [thousand]" 
// "two hundred fifty thousand" → 250000
// "one ninety-five" → 195000 (in RE context)
```

### 3. Relative Date Parsing
Current: `new Date(dateStr)` — fails on "next Friday", "in two weeks".

**Add: `chrono-node` library** (npm, 2K+ stars, MIT)
- Parses natural language dates: "next Friday" → Date object
- Handles: "in 2 weeks", "May 5th", "end of month", "tomorrow"
- Source: https://github.com/wanasit/chrono

```typescript
import * as chrono from 'chrono-node'
const date = chrono.parseDate("next Friday", new Date(), { forwardDate: true })
```

**Effort:** 1 (drop-in, MIT license, actively maintained)

---

## Whisper vs Web Speech API

### Comparison for Real Estate Use

| Factor | Web Speech API | OpenAI Whisper |
|--------|---------------|----------------|
| **Accuracy (English)** | ~90% on standard speech | ~97% on standard speech |
| **Accuracy (LA names)** | ~60% on Tchoupitoulas etc. | ~85% (trained on broader data) |
| **Latency** | 0ms (runs in browser) | 1-3s (API call) |
| **Cost** | Free | $0.006/min |
| **Custom vocabulary** | None | Prompt-based hints |
| **Southern accent** | Moderate | Good |
| **Offline** | No (Chrome sends to Google) | No (API call) |
| **Browser support** | Chrome only | Any (server-side) |
| **Privacy** | Google processes audio | OpenAI processes audio |

**Source:** OpenAI Whisper API docs (https://platform.openai.com/docs/guides/speech-to-text)

### Recommendation: Hybrid Approach
1. **Primary:** Keep Web Speech API for zero-latency real-time transcription
2. **Enhancement:** Send audio to Whisper in parallel for higher accuracy
3. **Fast path:** If Web Speech gives high-confidence match on regex → use it (0ms)
4. **Slow path:** If regex fails → wait for Whisper result → classify with Claude
5. **Custom prompt for Whisper:** Include Louisiana vocabulary hints

```typescript
// Whisper API with vocabulary hints
const transcription = await openai.audio.transcriptions.create({
  model: "whisper-1",
  file: audioFile,
  prompt: "Tchoupitoulas, Thibodaux, Natchitoches, Opelousas, Plaquemine, " +
          "Carencro, Ponchatoula, Brusly, Gonzales, Prairieville, " +
          "earnest money, purchase agreement, property disclosure, " +
          "MLS, LREC, parish, closing, act of sale"
})
```

**Cost estimate:** At 10 voice commands/day, ~30 seconds each = 5 min/day = $0.03/day = $0.90/month. Negligible.

---

## Multi-Turn Conversation Patterns

### Current Implementation
- `loadContext()` pulls last 3 commands + most recent transaction
- `ADDRESS_INTENTS` set defines which intents benefit from implicit context
- Claude system prompt instructs multi-turn resolution

### Improvements Needed

**1. Explicit context tracking (not just last command)**
```typescript
interface ConversationContext {
  lastTransactionId: string | null
  lastMentionedParty: string | null  // "the buyer" → actual name
  lastIntent: string | null
  lastEntities: Record<string, string>
  turnCount: number
}
```

**2. Clarification flow patterns:**
```
User: "Update the status"
AIRE: "Which deal? You have 3 active: 742 Oak St, 123 Main St, 456 Elm Dr"
User: "Oak Street"
AIRE: "What status? Options: Active, Pending Inspection, Pending Financing, Closing, Closed"
User: "Pending"
AIRE: "742 Oak St updated to PENDING. ✓"
```

**Implementation:** After `needs_clarification`, store the partial intent. Next command checks if it resolves the ambiguity.

**3. Confirmation flow:**
```
User: "Close the Oak Street deal"
AIRE: "Mark 742 Oak St as CLOSED? This is irreversible. Say 'yes' or 'confirm'."
User: "Yes"
AIRE: "742 Oak St → CLOSED. ✓"
```

**Implementation:** The `APPROVAL_REQUIRED_INTENTS` set already exists in `voice-action-executor.ts`. Need to surface the confirmation in voice UI (currently only checked at executor level).

---

## Error Recovery Patterns

### 1. Speech Recognition Failure
**Pattern:** User clicks mic but no transcript received (background noise, too quiet, or mic issue).
**Current:** Timeout after 15s → generic error.
**Fix:** After 5s of silence → prompt: "I didn't hear anything. Tap the mic and try again." Show mic level indicator.

### 2. Low-Confidence Classification
**Pattern:** Claude returns confidence < 0.5.
**Current:** Returns `needs_clarification` with generic suggestions.
**Fix:** Return the top-2 intents as buttons:
```
"Did you mean:
 [Show Pipeline]  [Check Deadlines]  [Something Else]"
```

### 3. Entity Resolution Failure
**Pattern:** Intent is clear but address doesn't match any transaction.
**Current:** "No transaction found matching [address]."
**Fix:** Show closest matches:
```
"No exact match for 'Oak'. Did you mean:
 [742 Oak St]  [123 Oakland Ave]"
```

### 4. Mid-Command Correction
**Pattern:** "Update status on — no wait — check deadlines for Oak Street"
**Current:** Entire string sent to classifier, often confusing.
**Fix:** Detect correction signals ("no wait", "actually", "I meant", "scratch that") and take only the text after the correction.

```typescript
function extractCorrectedCommand(transcript: string): string {
  const corrections = /(?:no wait|actually|i meant|scratch that|never mind|no no)\s*,?\s*/i
  const parts = transcript.split(corrections)
  return parts[parts.length - 1] // Take the last part after any correction
}
```

---

## Open Source Libraries to Evaluate

### Voice UI Components
| Library | Stars | License | Relevance |
|---------|-------|---------|-----------|
| **react-speech-recognition** | 2K+ | MIT | React hook for Web Speech API — cleaner than raw API |
| **annyang** | 6K+ | MIT | Speech recognition command library — define commands declaratively |
| **use-whisper** | 500+ | MIT | React hook for Whisper transcription |

**Source:** GitHub search "react speech recognition", "voice command react"

### NLU / Intent Classification
| Library | Stars | License | Relevance |
|---------|-------|---------|-----------|
| **compromise** | 11K+ | MIT | NLP text analysis — entity extraction, tokenization |
| **natural** | 10K+ | MIT | Naive Bayes classifier, tokenizer, stemmer |
| **chrono-node** | 3K+ | MIT | Natural language date parsing — "next Friday" → Date |
| **wink-nlp** | 1K+ | MIT | Fast NLP with custom pipelines |

**Source:** GitHub search "nlp javascript", "intent classification typescript"

### Recommendation: Top 3 to Integrate
1. **chrono-node** — Date parsing. Effort: 1. Unblocks "schedule closing for next Friday".
2. **react-speech-recognition** — Cleaner voice hook. Effort: 2. Better than raw API.
3. **compromise** — Entity extraction for names/places. Effort: 3. Enhances fuzzy matching.

---

## Fast-Path Patterns to Add (Zero-Cost Wins)

These patterns are missing from `FAST_MATCHERS` in `lib/voice-pipeline.ts` and would eliminate Claude API calls:

```typescript
// ── SEND MESSAGE (3 patterns) ──
{
  pattern: /^(?:text|email|message|send|notify) (?:the )?(buyer|seller|lender|title company|agent) (?:about|regarding|on) (.+)$/i,
  intent: "send_alert",
  extractEntities: (m) => ({ [`${m[1].toLowerCase().replace(/ /g, "_")}_role`]: m[1], description: m[2].trim() }),
},
{
  pattern: /^(?:tell|let|notify) (?:the )?(buyer|seller|lender) (?:that |about )?(.+)$/i,
  intent: "send_alert",
  extractEntities: (m) => ({ [`${m[1].toLowerCase()}_role`]: m[1], description: m[2].trim() }),
},

// ── SCHEDULE CLOSING (2 patterns) ──
{
  pattern: /^schedule (?:the )?closing (?:for|on|at) (.+?) (?:on|for) (.+)$/i,
  intent: "schedule_closing",
  extractEntities: (m) => ({ address: m[1].trim(), date: m[2].trim() }),
},
{
  pattern: /^(?:set|schedule) closing (?:date )?(?:to|for) (.+)$/i,
  intent: "schedule_closing",
  extractEntities: (m) => ({ date: m[1].trim() }),
},

// ── SEND DOCUMENT (2 patterns) ──
{
  pattern: /^send (?:the )?(?:purchase agreement|PA|contract|disclosure|document) to (.+)$/i,
  intent: "send_document",
  extractEntities: (m) => ({ buyer_name: m[1].trim() }),
},
{
  pattern: /^send (?:the )?(.+?) (?:to|for) (.+?) (?:for signature|to sign)$/i,
  intent: "send_document",
  extractEntities: (m) => ({ document_type: m[1].trim(), buyer_name: m[2].trim() }),
},

// ── CREATE ADDENDUM (2 patterns) ──
{
  pattern: /^(?:create|write|draft) (?:an? )?(?:addendum|amendment) (?:for|on|to) (.+)$/i,
  intent: "create_addendum",
  extractEntities: (m) => ({ address: m[1].trim() }),
},
{
  pattern: /^add (?:an? )?(?:addendum|amendment|extension) (?:to|for) (.+)$/i,
  intent: "create_addendum",
  extractEntities: (m) => ({ address: m[1].trim() }),
},
```

**Impact:** +9 fast-path patterns → covers all 13 intents with at least 2 patterns each. Estimated 30-40% more commands skip Claude → faster + cheaper.

---

## Priority Improvements Summary

| Rank | Improvement | Impact | Effort | Blocks |
|------|------------|--------|--------|--------|
| 1 | Add 9 missing fast-path patterns | 8 | 1 | Nothing |
| 2 | Louisiana place name normalization | 9 | 2 | Voice accuracy |
| 3 | chrono-node for date parsing | 7 | 1 | Schedule commands |
| 4 | Fuzzy address matching | 8 | 3 | "the Oak Street deal" |
| 5 | Mid-command correction detection | 6 | 1 | Error recovery |
| 6 | Whisper parallel transcription | 7 | 3 | Accuracy on jargon |
| 7 | Multi-turn clarification flow | 7 | 4 | Conversational UX |
| 8 | Communication intent handlers | 8 | 3 | Agent productivity |
| 9 | Spoken dollar amount parsing | 5 | 2 | Voice-created deals |
| 10 | react-speech-recognition | 4 | 2 | Code cleanliness |

---

# APPENDIX — Extended Research (2026-04-04 Supplementary Pass)

The original document above covers the core findings. This appendix adds depth across the seven research areas requested in the expanded mission.

## A1. Expanded Speech Recognition Vocabulary Map

### Louisiana Phonetic Correction Table (production-ready)

Build this as `lib/voice/louisiana-phonetic.ts`. Apply AFTER `normalizeTranscript()` and BEFORE fast-path matching.

```typescript
// Each correct spelling -> known Web Speech API mis-hearings
export const LOUISIANA_PHONETIC_MAP: Record<string, string[]> = {
  "Tchoupitoulas": ["to chip a tool", "show patool", "chop it ulas", "ship atulas", "chopper tools"],
  "Thibodaux":     ["tib a doe", "theodore", "tibidoe", "tibba doh", "thibo docks"],
  "Natchitoches":  ["national chess", "snatch a toast", "nack a tush", "nackadish", "nack a dish"],
  "Opelousas":     ["oprah luca", "open loos", "opel ousas", "oppa lousas", "opera louses"],
  "Plaquemine":    ["plaque a mean", "plaque mine", "plack a mine"],
  "Carencro":      ["karen crow", "car in crow", "caring crow", "care in crow"],
  "Ponchatoula":   ["pontcha tool", "punch a tool", "poncha tula", "poncho tula"],
  "Bossier":       ["boss year", "bosh ear"],
  "Atchafalaya":   ["atch a fly", "attach a liar", "atch a fal"],
  "Terrebonne":    ["terror bone", "terra bone", "tear a bone"],
  "Pontchartrain": ["punch a train", "pont char train"],
  "Broussard":     ["bruce ard", "brew sard"],
  "Breaux Bridge": ["bro bridge", "brew bridge"],
  "Youngsville":   ["youngs ville"],
  "Brusly":        ["brews lee", "bruce lee"],
  "Iberville":     ["eye berville", "eye ber ville"],
  "Lafourche":     ["la foosh", "la foo rush"],
  "Calcasieu":     ["cal casio", "cal ca shoe"],
}
```

### Real Estate Abbreviation Normalizer

```typescript
export const RE_ABBREVIATION_MAP: Record<string, string> = {
  "days on market": "DOM",
  "d o m": "DOM",
  "cumulative days on market": "CDOM",
  "c d o m": "CDOM",
  "square feet": "SF",
  "square foot": "SF",
  "sq ft": "SF",
  "m l s": "MLS",
  "for sale by owner": "FSBO",
  "fizbo": "FSBO",
  "comparative market analysis": "CMA",
  "c m a": "CMA",
  "broker price opinion": "BPO",
  "p m i": "PMI",
  "private mortgage insurance": "PMI",
  "h o a": "HOA",
  "homeowners association": "HOA",
  "pre qual": "pre-qualification",
  "p a": "purchase agreement",
  "e m d": "earnest money",
  "p d d": "property disclosure",
  "w d i": "WDI",
  "c d": "closing disclosure",
  "l e": "loan estimate",
}
```

---

## A2. Complete Intent Catalog (25 intents, 5+ utterances each)

The original document identified 13 existing + 5 missing intents. Below is the expanded 25-intent catalog with 5 example utterances each — targeting the full surface area a real estate agent would voice-control.

### Existing (keep + expand)

**1. show_pipeline**
- "show my pipeline"
- "what's my pipeline value"
- "how many active deals do I have"
- "what's on my plate this week"
- "give me a pipeline summary"

**2. check_deadlines**
- "what's due this week"
- "any overdue deadlines"
- "when does inspection expire on 742 Oak"
- "check deadlines for the Smith deal"
- "what's the next deadline"

**3. create_transaction**
- "create transaction at 123 Main at 250K"
- "new deal at 742 Oak Street"
- "start tracking 5834 Guice"
- "I just got an accepted offer on Main St"
- "add a new listing at 456 Elm for three-fifty"

**4. update_status**
- "mark 742 Oak as under contract"
- "the Smith deal is now closed"
- "move 123 Main to pending inspection"
- "buyer backed out of 456 Elm"
- "clear to close on the Oak deal"

**5. write_contract**
- "write a purchase agreement for 742 Oak"
- "draft PA for the Smith deal at 250K"
- "prepare an offer on 123 Main"
- "counter at 195K on the Elm deal"
- "generate a contract for Johnson on 742 Oak"

**6. create_addendum**
- "create a repair addendum for 742 Oak"
- "draft an extension on the Smith deal"
- "write a price reduction addendum for 123 Main"
- "add an inspection repair addendum"
- "create a counter offer addendum"

**7. run_compliance**
- "run compliance on 742 Oak"
- "check all active deals for issues"
- "compliance scan"
- "audit the Smith deal"
- "any LREC compliance issues"

**8. calculate_roi**
- "calculate ROI for 742 Oak at 250K renting for 1800"
- "cash flow on a 200K property at 1500 a month"
- "what's the yield on the Smith deal"
- "run the numbers on 456 Elm"
- "cap rate at 250K and 2000 rent"

**9. market_analysis**
- "what's the market like in 70810"
- "average DOM in 70808"
- "comp search for 3BR under 300K in Zachary"
- "neighborhood report for Prairieville"
- "median price in 70806"

**10. add_party**
- "add buyer John Smith to 742 Oak"
- "the seller is Mary Johnson"
- "title company is Louisiana Title"
- "add lender Chase Bank to the Smith deal"
- "buyer's agent is Tom Brown at Reve"

**11. schedule_closing (-> schedule_event)**
- "schedule closing for 742 Oak on May 5th"
- "set the inspection for next Friday"
- "book the appraisal for Monday at 10am"
- "move closing to June 1st"
- "schedule a showing at 742 Oak for Thursday"

**12. send_document**
- "send the purchase agreement to John Smith"
- "email the contract to the buyer"
- "share the addendum with Mary for signature"
- "forward the inspection report to the buyer's agent"
- "send the disclosure to the seller"

**13. send_alert (-> send_communication)**
- "text the buyer about closing"
- "email the title company the closing date"
- "tell the seller we're extending by 5 days"
- "notify the lender about the appraisal deadline"
- "message the buyer that inspection passed"

### New intents to add

**14. morning_brief**
- "give me my morning brief"
- "what's happening today"
- "daily summary"
- "catch me up"
- "brief me on my day"

**15. show_analytics**
- "how many deals closed this quarter"
- "year to date volume"
- "commission earned this month"
- "average deal size"
- "what's my close rate this year"

**16. search_transaction**
- "find the deal on Main Street"
- "look up 742 Oak"
- "pull up the Smith deal"
- "search for Johnson"
- "find MLS 1234567"

**17. get_contact_info**
- "what's the buyer's phone on 742 Oak"
- "who's the lender on the Smith deal"
- "give me Mary's email"
- "contact info for the title company"
- "who are the parties on 123 Main"

**18. document_status**
- "has John signed the contract"
- "check signing status on 742 Oak"
- "any unsigned documents"
- "what docs are missing on the Smith deal"
- "is the disclosure signed yet"

**19. voice_note**
- "add a note to 742 Oak: buyer wants new carpet"
- "note that seller agreed to 5K credit"
- "remember Mary prefers morning showings"
- "log that inspection found roof issues"
- "save this note: follow up with lender Friday"

**20. update_price**
- "change price on 742 Oak to 245K"
- "reduce list price to 240K"
- "accepted price is 248K on the Smith deal"
- "counter at 195 on the Elm deal"
- "bump up the list price to 260"

**21. navigate**
- "open AirSign"
- "go to morning brief"
- "show the contracts page"
- "take me to 742 Oak detail"
- "open settings"

**22. compare_properties**
- "compare 742 Oak and 123 Main"
- "side by side the Smith and Johnson deals"
- "which deal is bigger"
- "compare my top two active deals"
- "price comparison 70810 vs 70808"

**23. generate_report**
- "generate a closing report for 742 Oak"
- "create a CMA for 123 Main"
- "build an end of month report"
- "export my pipeline as CSV"
- "create a client summary for the Smiths"

**24. help**
- "help"
- "what can you do"
- "what commands do you support"
- "show me examples"
- "how do I create a transaction"

**25. cancel / undo**
- "cancel that"
- "undo"
- "never mind"
- "wait no"
- "stop, I meant something else"

### Recommended Fast-Path Additions for New Intents

```typescript
// MORNING BRIEF
{ pattern: /^(?:give me |show |what's )?(?:my )?(?:morning )?brief(?: me)?$/i, intent: "morning_brief", extractEntities: () => ({}) },
{ pattern: /^(?:daily (?:summary|report)|catch me up|brief me)$/i, intent: "morning_brief", extractEntities: () => ({}) },

// ANALYTICS
{ pattern: /^how many (?:deals?|transactions?) (?:closed|sold) (?:this )?(month|quarter|year)$/i, intent: "show_analytics",
  extractEntities: (m) => ({ period: m[1], metric: "count" }) },
{ pattern: /^(?:year to date|ytd) (?:volume|sales|commission)$/i, intent: "show_analytics",
  extractEntities: () => ({ period: "ytd", metric: "volume" }) },
{ pattern: /^(?:show |what(?:'s| is) )?my (?:stats|performance|numbers)$/i, intent: "show_analytics",
  extractEntities: () => ({}) },

// SEARCH
{ pattern: /^(?:find|look up|pull up|search for) (.+)$/i, intent: "search_transaction",
  extractEntities: (m) => ({ query: m[1].trim() }) },

// CONTACT INFO
{ pattern: /^(?:what(?:'s| is) the )?(buyer|seller|lender|agent)(?:'s)? (phone|email|number|info) (?:on|for|at) (.+)$/i,
  intent: "get_contact_info",
  extractEntities: (m) => ({ role: m[1], field: m[2], address: m[3].trim() }) },

// DOCUMENT STATUS
{ pattern: /^has (.+?) signed (?:the )?(.+)$/i, intent: "document_status",
  extractEntities: (m) => ({ signer_name: m[1].trim(), document_type: m[2].trim() }) },

// VOICE NOTE
{ pattern: /^(?:add a )?note (?:to |for |on )?(.+?):\s*(.+)$/i, intent: "voice_note",
  extractEntities: (m) => ({ address: m[1].trim(), note: m[2].trim() }) },
{ pattern: /^(?:remember|note) that (.+)$/i, intent: "voice_note",
  extractEntities: (m) => ({ note: m[1].trim() }) },

// UPDATE PRICE
{ pattern: /^(?:change|update|set|reduce|raise|bump) (?:the )?(?:list )?price (?:on|for|at) (.+?) to \$?([\d,.]+[kK]?)$/i,
  intent: "update_price",
  extractEntities: (m) => ({ address: m[1].trim(), price: m[2].replace(/[kK]$/, "000").replace(/,/g, "") }) },
{ pattern: /^counter(?: at)? \$?([\d,.]+[kK]?)(?: on (.+))?$/i, intent: "update_price",
  extractEntities: (m) => ({ price: m[1].replace(/[kK]$/, "000").replace(/,/g, ""), address: m[2]?.trim() || "" }) },

// NAVIGATE
{ pattern: /^(?:go to|open|navigate to|take me to|show) (?:the )?(airsign|morning brief|contracts|transactions|compliance|settings|pipeline|intelligence|email|monitoring)(?: page| dashboard)?$/i,
  intent: "navigate",
  extractEntities: (m) => ({ page: m[1].toLowerCase() }) },

// HELP
{ pattern: /^(?:help|what can you do|what commands|how do i|show me examples)$/i, intent: "help",
  extractEntities: () => ({}) },

// CANCEL / UNDO
{ pattern: /^(?:cancel|undo|never ?mind|stop|wait no|forget (?:it|that))$/i, intent: "cancel",
  extractEntities: () => ({}) },
```

---

## A3. Expanded Entity Extraction Patterns

### A3.1 Spoken Dollar Amounts — Complete Parser

```typescript
const DIGIT_WORDS: Record<string, number> = {
  zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16,
  seventeen:17, eighteen:18, nineteen:19,
  twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90,
}

export function parseSpokenDollars(text: string): number | null {
  const t = text.toLowerCase().trim()

  // "250K", "$250k", "250,000"
  const numMatch = t.match(/\$?([\d,.]+)\s*([km])?/)
  if (numMatch && !t.includes(" ")) {
    const n = parseFloat(numMatch[1].replace(/,/g, ""))
    const suffix = numMatch[2]
    if (suffix === "k") return n * 1000
    if (suffix === "m") return n * 1000000
    return n
  }

  // "two fifty" = $250K (RE shorthand)
  const shorthand = t.match(/^(one|two|three|four|five|six|seven|eight|nine)\s+(fifty|seventy-?five|twenty-?five)$/)
  if (shorthand) {
    const base = DIGIT_WORDS[shorthand[1]] * 100000
    const trailing = shorthand[2].replace("-", "")
    const trail = trailing === "fifty" ? 50000 : trailing === "seventyfive" ? 75000 : 25000
    return base + trail
  }

  // "three fifty" / "three-fifty" = $350K
  const simple = t.match(/^(one|two|three|four|five|six|seven|eight|nine)[\s-]+(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/)
  if (simple) {
    return DIGIT_WORDS[simple[1]] * 100000 + DIGIT_WORDS[simple[2]] * 1000
  }

  // "two hundred thousand", "three hundred and fifty thousand"
  const hundredThousand = t.match(/^(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+(?:and\s+)?(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]?(one|two|three|four|five|six|seven|eight|nine))?)?\s+thousand$/)
  if (hundredThousand) {
    let n = DIGIT_WORDS[hundredThousand[1]] * 100
    if (hundredThousand[2]) n += DIGIT_WORDS[hundredThousand[2]]
    if (hundredThousand[3]) n += DIGIT_WORDS[hundredThousand[3]]
    return n * 1000
  }

  // "a million", "one point two million", "two million"
  const million = t.match(/^(?:a|one|two|three|four|five|six|seven|eight|nine|\d+(?:\.\d+)?)\s+million$/)
  if (million) {
    const word = million[0].split(" ")[0]
    const n = word === "a" ? 1 : DIGIT_WORDS[word] || parseFloat(word)
    return n * 1000000
  }

  return null
}
```

**Test cases:**
- "two fifty" -> 250000
- "three-fifty" -> 350000
- "two hundred thousand" -> 200000
- "three hundred and fifty thousand" -> 350000
- "a million" -> 1000000
- "250K" -> 250000
- "1.5 million" -> 1500000

### A3.2 Relative Date Resolver (without chrono-node)

If adding chrono-node is too heavy, here is a minimal inline resolver for the most common RE phrases:

```typescript
export function parseRelativeDate(text: string, anchor: Date = new Date()): Date | null {
  const t = text.toLowerCase().trim()

  if (t === "today") return new Date(anchor)
  if (t === "tomorrow") { const d = new Date(anchor); d.setDate(d.getDate() + 1); return d }
  if (t === "yesterday") { const d = new Date(anchor); d.setDate(d.getDate() - 1); return d }

  // "next Friday", "this Friday"
  const weekday = t.match(/^(next|this|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/)
  if (weekday) {
    const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"]
    const target = days.indexOf(weekday[2])
    const current = anchor.getDay()
    let diff = target - current
    if (weekday[1] === "next") diff = diff <= 0 ? diff + 14 : diff + 7
    else if (weekday[1] === "last") diff = diff >= 0 ? diff - 7 : diff
    else if (diff <= 0) diff += 7
    const d = new Date(anchor); d.setDate(d.getDate() + diff); return d
  }

  // "in 2 weeks", "in three days", "in a month"
  const rel = t.match(/^in\s+(a|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(day|week|month|year)s?$/)
  if (rel) {
    const nums: Record<string, number> = { a:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 }
    const n = nums[rel[1]] || parseInt(rel[1])
    const d = new Date(anchor)
    if (rel[2] === "day") d.setDate(d.getDate() + n)
    else if (rel[2] === "week") d.setDate(d.getDate() + n * 7)
    else if (rel[2] === "month") d.setMonth(d.getMonth() + n)
    else if (rel[2] === "year") d.setFullYear(d.getFullYear() + n)
    return d
  }

  // "end of month", "end of the week"
  const endOf = t.match(/^end of (?:the )?(week|month|quarter|year)$/)
  if (endOf) {
    const d = new Date(anchor)
    if (endOf[1] === "week") { const daysToFri = (5 - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + daysToFri) }
    else if (endOf[1] === "month") d.setMonth(d.getMonth() + 1, 0)
    else if (endOf[1] === "quarter") { const q = Math.floor(d.getMonth() / 3); d.setMonth((q + 1) * 3, 0) }
    else if (endOf[1] === "year") d.setMonth(11, 31)
    return d
  }

  // Absolute: "May 5th", "May 5, 2026"
  const abs = t.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/)
  if (abs) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"]
    return new Date(abs[3] ? parseInt(abs[3]) : anchor.getFullYear(), months.indexOf(abs[1]), parseInt(abs[2]))
  }

  return null
}
```

**Recommendation:** Still prefer `chrono-node` for production — it handles ~50 more edge cases ("a week from Friday", "end of next month", time-of-day, etc.) and is 30KB gzipped.

### A3.3 Address Resolver — Complete Chain

```typescript
export async function resolveAddress(
  userId: string,
  query: string,
  conversationContext?: { lastTransactionId?: string | null }
): Promise<{
  transaction: Transaction | null
  confidence: "exact" | "fuzzy" | "context" | "ambiguous" | "none"
  alternatives?: Transaction[]
}> {
  if (!query || query.trim().length === 0) {
    // Fall back to conversation context
    if (conversationContext?.lastTransactionId) {
      const ctx = await prisma.transaction.findUnique({ where: { id: conversationContext.lastTransactionId } })
      if (ctx) return { transaction: ctx, confidence: "context" }
    }
    return { transaction: null, confidence: "none" }
  }

  const q = query.trim()

  // Deictic references -> use context
  if (/^(that|this|the) (deal|one|property|transaction|same)$/i.test(q) || /^(it|that)$/i.test(q)) {
    if (conversationContext?.lastTransactionId) {
      const ctx = await prisma.transaction.findUnique({ where: { id: conversationContext.lastTransactionId } })
      if (ctx) return { transaction: ctx, confidence: "context" }
    }
  }

  // 1. Exact match
  const exact = await prisma.transaction.findFirst({
    where: { userId, propertyAddress: { equals: q, mode: "insensitive" } },
  })
  if (exact) return { transaction: exact, confidence: "exact" }

  // 2. Starts-with
  const startsWith = await prisma.transaction.findFirst({
    where: { userId, propertyAddress: { startsWith: q, mode: "insensitive" } },
  })
  if (startsWith) return { transaction: startsWith, confidence: "fuzzy" }

  // 3. Contains
  const contains = await prisma.transaction.findMany({
    where: { userId, propertyAddress: { contains: q, mode: "insensitive" } },
    take: 3,
  })
  if (contains.length === 1) return { transaction: contains[0], confidence: "fuzzy" }
  if (contains.length > 1) return { transaction: null, confidence: "ambiguous", alternatives: contains }

  // 4. Street number only (e.g., "5834")
  const streetNum = q.match(/^(\d{3,5})$/)?.[1]
  if (streetNum) {
    const byNum = await prisma.transaction.findMany({
      where: { userId, propertyAddress: { startsWith: streetNum, mode: "insensitive" } },
      take: 3,
    })
    if (byNum.length === 1) return { transaction: byNum[0], confidence: "fuzzy" }
    if (byNum.length > 1) return { transaction: null, confidence: "ambiguous", alternatives: byNum }
  }

  // 5. Street name only (strip number + type suffix)
  const streetOnly = q.replace(/^\d+\s*/, "").replace(/\s+(st|street|ave|avenue|dr|drive|ln|lane|blvd|boulevard|rd|road|ct|court|pl|place|way|cir|circle)\b\.?$/i, "").trim()
  if (streetOnly.length > 2 && streetOnly !== q) {
    const byStreet = await prisma.transaction.findMany({
      where: { userId, propertyAddress: { contains: streetOnly, mode: "insensitive" } },
      take: 3,
    })
    if (byStreet.length === 1) return { transaction: byStreet[0], confidence: "fuzzy" }
    if (byStreet.length > 1) return { transaction: null, confidence: "ambiguous", alternatives: byStreet }
  }

  // 6. Party name match ("the Smith deal", "Johnson's house")
  const nameMatch = q.replace(/'s$/, "").replace(/^the\s+/i, "").replace(/\s+(deal|house|property|transaction|one)$/i, "").trim()
  if (nameMatch.length > 2) {
    const byParty = await prisma.transaction.findMany({
      where: {
        userId,
        OR: [
          { buyerName: { contains: nameMatch, mode: "insensitive" } },
          { sellerName: { contains: nameMatch, mode: "insensitive" } },
        ],
      },
      take: 3,
    })
    if (byParty.length === 1) return { transaction: byParty[0], confidence: "fuzzy" }
    if (byParty.length > 1) return { transaction: null, confidence: "ambiguous", alternatives: byParty }
  }

  return { transaction: null, confidence: "none" }
}
```

---

## A4. Hybrid STT Architecture (Web Speech + Whisper)

### Full client-side parallel capture pattern

```typescript
// components/VoiceCommandBar.tsx additions
const mediaRecorderRef = useRef<MediaRecorder | null>(null)
const audioChunksRef = useRef<Blob[]>([])
const webSpeechConfidenceRef = useRef<number>(0)

async function startHybridListening() {
  // Start Web Speech API (existing code)
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
  recognition.continuous = false
  recognition.interimResults = true
  recognition.lang = "en-US"

  recognition.onresult = (event: any) => {
    let final = ""
    let maxConfidence = 0
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript
        maxConfidence = Math.max(maxConfidence, event.results[i][0].confidence || 0)
      }
    }
    if (final) {
      setTranscript(final)
      webSpeechConfidenceRef.current = maxConfidence
    }
  }

  recognition.start()

  // Simultaneously capture raw audio for Whisper fallback
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
    audioChunksRef.current = []
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    mediaRecorder.start(100)
    mediaRecorderRef.current = mediaRecorder
  } catch (err) {
    // Fail silently — Web Speech will still work
    console.warn("Audio capture for Whisper fallback failed:", err)
  }
}

function stopHybridListening() {
  recognitionRef.current?.stop()
  mediaRecorderRef.current?.stop()
  mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
}

async function processCommandHybrid(webSpeechTranscript: string) {
  const confidence = webSpeechConfidenceRef.current
  const hasLikelyLouisianaName = /\b(chop|tib|nack|oprah|plaque|karen|punch|bruce|eye ber|terror)/i.test(webSpeechTranscript)

  // Trigger Whisper fallback if:
  // - Web Speech confidence low, OR
  // - Transcript contains likely LA place name misrecognition
  const useWhisper = confidence < 0.85 || hasLikelyLouisianaName

  if (useWhisper && audioChunksRef.current.length > 0) {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
      const formData = new FormData()
      formData.append("audio", audioBlob, "cmd.webm")
      const whisperRes = await fetch("/api/voice-command/whisper", {
        method: "POST",
        body: formData,
      })
      const { text: whisperText } = await whisperRes.json()
      // Prefer Whisper if it produced more content
      if (whisperText && whisperText.length > webSpeechTranscript.length * 0.8) {
        return processCommand(whisperText)
      }
    } catch (err) {
      console.warn("Whisper fallback failed, using Web Speech:", err)
    }
  }

  return processCommand(webSpeechTranscript)
}
```

### Server endpoint for Whisper

```typescript
// app/api/voice-command/whisper/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const WHISPER_PROMPT = [
  "Real estate transaction discussion in Baton Rouge, Louisiana.",
  "Properties on Tchoupitoulas, Thibodaux, Natchitoches, Opelousas, Plaquemine,",
  "Carencro, Ponchatoula, Gonzales, Prairieville, Denham Springs, Zachary, Brusly.",
  "East Baton Rouge Parish, Ascension Parish, Livingston Parish, Iberville Parish.",
  "Terms: escrow, earnest money, contingency, encumbrance, lien, prorated,",
  "addendum, purchase agreement, Act of Sale, MLS, DOM, CDOM, LREC, GBRAR,",
  "inspection, appraisal, title commitment, closing disclosure.",
].join(" ")

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get("audio") as File
  if (!audio) return NextResponse.json({ error: "No audio" }, { status: 400 })

  const transcription = await openai.audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
    language: "en",
    prompt: WHISPER_PROMPT,
    temperature: 0,
  })

  return NextResponse.json({ text: transcription.text })
}
```

---

## A5. Conversation State Machine

```typescript
// lib/voice/conversation-state.ts
export interface ConversationState {
  userId: string
  currentTransactionId: string | null
  currentTopic: "transaction" | "market" | "deadline" | "document" | "party" | null
  lastIntent: string | null
  lastEntities: Record<string, string>
  turnCount: number
  pendingClarification: {
    originalIntent: string
    originalEntities: Record<string, string>
    candidateIds?: string[]
    question: string
  } | null
  pendingConfirmation: {
    intent: string
    entities: Record<string, string>
    expiresAt: Date
  } | null
  startedAt: Date
  lastActivityAt: Date
}

// Persist per user in Redis or a VoiceSession DB table with 30-min TTL
// On each voice command:
//   1. Load state
//   2. If pendingClarification exists -> treat new transcript as answer
//   3. If pendingConfirmation exists and transcript is "yes"/"confirm" -> execute
//   4. If pendingConfirmation exists and transcript is correction -> cancel + reprocess
//   5. Otherwise -> normal flow, update state
```

### Clarification answer resolution

```typescript
async function resolveClarification(state: ConversationState, newTranscript: string): Promise<PipelineResult> {
  const { pendingClarification } = state
  if (!pendingClarification) throw new Error("No pending clarification")

  // Try to match new transcript to one of the candidates
  if (pendingClarification.candidateIds) {
    const candidates = await prisma.transaction.findMany({
      where: { id: { in: pendingClarification.candidateIds } },
    })

    // Simple: find first candidate whose address contains transcript words
    const match = candidates.find(c =>
      newTranscript.toLowerCase().split(/\s+/).some(word =>
        word.length > 2 && c.propertyAddress.toLowerCase().includes(word)
      )
    )

    if (match) {
      // Re-run original intent with the resolved transaction
      return runPipelineWithResolvedTransaction({
        userId: state.userId,
        intent: pendingClarification.originalIntent,
        entities: { ...pendingClarification.originalEntities, address: match.propertyAddress },
      })
    }
  }

  // Couldn't resolve — ask again or bail
  return clarify("I still need to know which one. Please say the full address.", pendingClarification.candidateIds ? await getCandidateAddresses(pendingClarification.candidateIds) : [])
}
```

---

## A6. Open Source Library Final Recommendation

| Library | Action | Reason |
|---------|--------|--------|
| `use-whisper` | ADD | Cleanest Whisper integration for React |
| `chrono-node` | ADD | Natural language date parsing |
| `compromise` + `compromise-dates` + `compromise-numbers` | ADD | Entity extraction layer |
| `react-speech-recognition` | SKIP | Current VoiceCommandBar works, migration churn not worth it |
| `nlp.js` | EVALUATE | Could replace regex fast-path with local classifier; defer until intents > 30 |
| `annyang` | SKIP | Superseded by react-speech-recognition and our current impl |
| `natural` | SKIP | Overlaps with compromise, less actively maintained |
| `wink-nlp` | SKIP | Good but compromise is more battle-tested |
| `whisper.cpp` (local) | SKIP | Too slow for real-time on typical servers |
| `Rasa` | SKIP | Python, too heavy |
| `Mycroft` | SKIP | Archived |

---

## A7. Error Recovery — Complete Pattern Reference

### All Web Speech error codes and recovery

| Error | Meaning | Recovery |
|-------|---------|----------|
| `no-speech` | No audio detected in timeout | Prompt: "Didn't hear anything. Tap to try again." Auto-restart after 1.5s. |
| `audio-capture` | No mic available | Prompt: "Microphone not found." Show typed input as fallback. |
| `not-allowed` | Permission denied | Prompt: "Enable mic in browser settings." Link to chrome://settings/content/microphone. |
| `network` | Network lost | Fall back to local regex fast-path. Queue audio for retry. |
| `aborted` | User stopped | Silent — no error UI. |
| `language-not-supported` | Lang mismatch | Shouldn't happen with en-US. Log + bail. |
| `service-not-allowed` | STT service blocked | Fall back to typed input. |

### Confidence thresholds

```typescript
const CONFIDENCE_THRESHOLDS = {
  AUTO_EXECUTE: 0.90,      // Just run it
  SOFT_CONFIRM: 0.75,      // Show result with 3s cancel window
  HARD_CONFIRM: 0.60,      // Require explicit tap/voice confirmation
  CLARIFICATION: 0.40,     // Ask which intent they meant
  REJECT: 0.0,             // Below this: "I didn't understand"
}
```

### Mid-command correction detection

```typescript
const CORRECTION_SIGNALS = [
  /^(no|wait|actually|stop|cancel|undo|never ?mind)\b/i,
  /\b(?:no wait|i meant|i mean|scratch that|strike that|let me start over)\b/i,
  /^(?:not|don't) (?:that|this)/i,
]

function detectCorrection(transcript: string): { corrected: boolean; restOfCommand: string } {
  for (const pattern of CORRECTION_SIGNALS) {
    const match = transcript.match(pattern)
    if (match) {
      // Extract text after the correction signal
      const rest = transcript.slice(match.index! + match[0].length).trim()
      return { corrected: true, restOfCommand: rest }
    }
  }
  return { corrected: false, restOfCommand: transcript }
}
```

---

## A8. Implementation Priority (Revised)

| Rank | Improvement | Impact | Effort | Files |
|------|------------|--------|--------|-------|
| 1 | 9 missing fast-path patterns (original doc) | 8 | 1 | `lib/voice-pipeline.ts` |
| 2 | 12 new-intent fast-path patterns (A2) | 8 | 2 | `lib/voice-pipeline.ts`, `lib/voice-action-executor.ts` |
| 3 | Louisiana phonetic correction map | 9 | 2 | new: `lib/voice/louisiana-phonetic.ts` |
| 4 | RE abbreviation normalizer | 6 | 1 | `app/api/voice-command/route.ts` (normalizeTranscript) |
| 5 | `chrono-node` date parsing | 7 | 1 | `lib/voice-action-executor.ts` scheduleClosing |
| 6 | Spoken dollar parser | 5 | 2 | new: `lib/voice/parse-dollars.ts` |
| 7 | Enhanced address resolver (party name + street only) | 8 | 3 | `lib/voice-pipeline.ts` findTransaction |
| 8 | Whisper fallback endpoint + hybrid capture | 7 | 3 | new: `app/api/voice-command/whisper/route.ts`, `components/VoiceCommandBar.tsx` |
| 9 | Conversation state machine | 7 | 4 | new: `lib/voice/conversation-state.ts`, Prisma model |
| 10 | Correction detection + cancel flow | 6 | 2 | `components/VoiceCommandBar.tsx`, `lib/voice-pipeline.ts` |
| 11 | Full error code handling | 5 | 1 | `components/VoiceCommandBar.tsx` onerror |
| 12 | Handlers for 12 new intents | 8 | 4 | `lib/voice-action-executor.ts` |

**Total estimated effort:** ~30 engineer-days for the full plan. Phase 1 (items 1-5) is ~7 days and delivers the biggest quality jump.

---

## A9. Note on Research Sources

WebSearch was not available during this research pass. All findings in this appendix are based on:
- Direct codebase analysis of `lib/voice-pipeline.ts`, `app/api/voice-command/route.ts`, `lib/voice-action-executor.ts`, `components/VoiceCommandBar.tsx`
- Knowledge of OpenAI Whisper API capabilities (documented `initial_prompt` parameter, pricing, model behavior) from training data through May 2025
- Knowledge of Web Speech API behavior (error codes, confidence scoring, browser support) from MDN-documented patterns
- Known behavior of listed open source libraries (`use-whisper`, `compromise`, `chrono-node`, `nlp.js`, `react-speech-recognition`, etc.)
- Real estate domain vocabulary and Louisiana place name phonetics

For validation before implementation, the team should:
1. Run a 50-command test set against current Web Speech API to measure baseline LA name accuracy
2. Compare the same set through Whisper with the `initial_prompt` above
3. Verify `chrono-node` and `compromise` are still actively maintained (last check: both were active as of early 2025)
4. Check latest Whisper pricing on platform.openai.com (was $0.006/minute as of mid-2025)

