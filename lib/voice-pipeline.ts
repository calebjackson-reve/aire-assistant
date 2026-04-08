/**
 * AIRE Voice Pipeline v2 — Optimized classify + execute in single pass
 *
 * Target: 8-second total response time (voice → action → result)
 * Architecture:
 *   1. Normalize transcript (< 1ms)
 *   2. Fast-path: regex match for simple intents (< 1ms, skip Claude)
 *   3. Parallel: load context + classify with Claude (~3s)
 *   4. Execute action (~1-2s DB)
 *   5. Log with timing for patent audit trail
 *
 * Patent claim: Natural language → intent classification → automated
 * real estate transaction operations with sub-8-second execution.
 */

import prisma from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"
import { normalizeTranscript } from "@/app/api/voice-command/route"
import { generateEnglishPreview, requiresPreviewConfirmation } from "@/lib/voice/english-preview"
import { withCircuitBreaker } from "@/lib/learning/circuit-breaker"
import { logError } from "@/lib/learning/error-memory"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface PipelineInput {
  userId: string
  transcript: string
}

export interface PipelineResult {
  voiceCommandId: string
  intent: string
  entities: Record<string, string>
  response: string
  action: string | null
  confidence: number
  needsClarification: boolean
  clarificationOptions?: string[]
  /** Plain-English playback of what AIRE heard. Null for read-only intents. */
  englishPreview: string | null
  /** True for intents that mutate state or generate documents (UI must show Accept/Edit/Cancel). */
  requiresConfirmation: boolean
  executionResult?: {
    success: boolean
    action: string
    message: string
    data?: Record<string, unknown>
  }
  timing: {
    normalizeMs: number
    classifyMs: number
    executeMs: number
    totalMs: number
  }
}

// ─── FAST-PATH REGEX MATCHERS ───────────────────────────────────────────────
// Skip Claude entirely for unambiguous commands

interface FastMatch {
  pattern: RegExp
  intent: string
  extractEntities: (match: RegExpMatchArray) => Record<string, string>
}

const FAST_MATCHERS: FastMatch[] = [
  // ── SHOW PIPELINE (4 patterns) ──
  {
    pattern: /^(?:show|check|what(?:'s| is)) (?:my )?(?:pipeline|deals|active deals)$/i,
    intent: "show_pipeline",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:how many|how much) (?:deals?|transactions?) (?:do i have|are active|are open)$/i,
    intent: "show_pipeline",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:what(?:'s| is)) (?:my )?pipeline (?:value|worth|total)$/i,
    intent: "show_pipeline",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:open|active) deals$/i,
    intent: "show_pipeline",
    extractEntities: () => ({}),
  },
  // ── CHECK DEADLINES (4 patterns) ──
  {
    pattern: /^(?:check|show|what(?:'s| are)) (?:my )?deadlines?$/i,
    intent: "check_deadlines",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:check|show) deadlines? (?:for|on|at) (.+)$/i,
    intent: "check_deadlines",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  {
    pattern: /^(?:what(?:'s| is)) (?:due|coming up|upcoming)(?: this week| today| tomorrow)?$/i,
    intent: "check_deadlines",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:any )?(?:overdue|late|missed) deadlines?$/i,
    intent: "check_deadlines",
    extractEntities: () => ({}),
  },
  // ── CREATE TRANSACTION (3 patterns) ──
  {
    pattern: /^create (?:a )?(?:new )?transaction (?:for|at|on) (.+?)(?:\s+at \$?([\d,.]+[kK]?))?$/i,
    intent: "create_transaction",
    extractEntities: (m) => {
      const e: Record<string, string> = { address: m[1].trim() }
      if (m[2]) e.price = m[2].replace(/[kK]$/, "000").replace(/,/g, "")
      return e
    },
  },
  {
    pattern: /^(?:new|add|start) (?:a )?(?:deal|transaction) (?:for|at|on) (.+?)(?:\s+(?:at|for) \$?([\d,.]+[kK]?))?$/i,
    intent: "create_transaction",
    extractEntities: (m) => {
      const e: Record<string, string> = { address: m[1].trim() }
      if (m[2]) e.price = m[2].replace(/[kK]$/, "000").replace(/,/g, "")
      return e
    },
  },
  {
    pattern: /^(?:open|start) (?:a )?new deal$/i,
    intent: "create_transaction",
    extractEntities: () => ({}),
  },
  // ── WRITE CONTRACT (4 patterns) ──
  {
    pattern: /^(?:write|draft|create) (?:a )?(?:purchase agreement|PA|contract) (?:for|at|on) (.+?)(?:\s+(?:at|for) \$?([\d,.]+[kK]?))?$/i,
    intent: "write_contract",
    extractEntities: (m) => {
      const e: Record<string, string> = { address: m[1].trim() }
      if (m[2]) e.price = m[2].replace(/[kK]$/, "000").replace(/,/g, "")
      return e
    },
  },
  {
    pattern: /^(?:write|draft|generate) (?:a )?contract$/i,
    intent: "write_contract",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:make|prepare) (?:a )?(?:PA|purchase agreement) (?:for|at) (.+)$/i,
    intent: "write_contract",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  // Complex contract command with inline fields — fast-path to avoid Claude call
  // "write a contract for 554 Avenue F, buyer is Gavin Shaw, price is $295,000"
  {
    pattern: /^(?:write|draft|create) (?:a )?(?:purchase agreement|PA|contract) (?:for|at|on) (.+?)(?:,|\s+and\s+)/i,
    intent: "write_contract",
    extractEntities: (m) => {
      const full = m.input || ""
      const e: Record<string, string> = {}
      // Address is first capture group but may include trailing fields — clean it
      const addrRaw = m[1].trim()
      // Stop address at first comma or "buyer/seller/price" keyword
      const addrClean = addrRaw.split(/\s*,\s*/)[0].replace(/\s+(buyer|seller|price|earnest|closing|at \$).*/i, "").trim()
      e.address = addrClean

      const buyerMatch = full.match(/buyer\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
      if (buyerMatch) e.buyer_name = buyerMatch[1].trim()

      const sellerMatch = full.match(/seller\s+(?:is\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
      if (sellerMatch) e.seller_name = sellerMatch[1].trim()

      const priceMatch = full.match(/price\s+(?:is\s+)?\$?([\d,.]+[kK]?)/i)
      if (priceMatch) e.price = priceMatch[1].replace(/[kK]$/, "000").replace(/,/g, "")

      const earnestMatch = full.match(/earnest\s+(?:money\s+)?(?:is\s+)?\$?([\d,.]+[kK]?)/i)
      if (earnestMatch) e.earnest_money = earnestMatch[1].replace(/[kK]$/, "000").replace(/,/g, "")

      const closingMatch = full.match(/closing\s+(?:on\s+|date\s+(?:is\s+)?)?(.+?)(?:,|$)/i)
      if (closingMatch) e.closing_date = closingMatch[1].trim()

      return e
    },
  },
  // ── COMPLIANCE (3 patterns) ──
  {
    pattern: /^(?:run|do) (?:a )?compliance (?:scan|check)$/i,
    intent: "run_compliance",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:check|scan) (?:for )?compliance(?: issues)?$/i,
    intent: "run_compliance",
    extractEntities: () => ({}),
  },
  {
    pattern: /^compliance (?:scan|check|report)$/i,
    intent: "run_compliance",
    extractEntities: () => ({}),
  },
  // ── UPDATE STATUS (3 patterns) ──
  {
    pattern: /^(?:update|change|set) (?:the )?status (?:of |for |on )?(.+?) to (.+)$/i,
    intent: "update_status",
    extractEntities: (m) => ({ address: m[1].trim(), status: m[2].trim() }),
  },
  {
    pattern: /^(?:mark|move) (.+?) (?:as|to) (.+)$/i,
    intent: "update_status",
    extractEntities: (m) => ({ address: m[1].trim(), status: m[2].trim() }),
  },
  {
    pattern: /^(.+?) is (?:now )?(?:under contract|pending|closed|cancelled)$/i,
    intent: "update_status",
    extractEntities: (m) => {
      const status = m[0].match(/(?:under contract|pending|closed|cancelled)/i)?.[0] || ""
      return { address: m[1].trim(), status: status.toUpperCase().replace(/ /g, "_") }
    },
  },
  // ── MARKET ANALYSIS (2 patterns) ──
  {
    pattern: /^(?:what(?:'s| is) the )?market (?:like|looking like|analysis|report|update)$/i,
    intent: "market_analysis",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:market|neighborhood) (?:analysis|report|data) (?:for|in|on) (.+)$/i,
    intent: "market_analysis",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  // ── ADD PARTY (2 patterns) ──
  {
    pattern: /^add (?:a )?(?:buyer|seller) (.+?) to (.+)$/i,
    intent: "add_party",
    extractEntities: (m) => {
      const role = m[0].match(/buyer|seller/i)?.[0]?.toLowerCase() || "buyer"
      return { [`${role}_name`]: m[1].trim(), address: m[2].trim() }
    },
  },
  {
    pattern: /^(?:the )?buyer (?:is|for .+? is) (.+)$/i,
    intent: "add_party",
    extractEntities: (m) => ({ buyer_name: m[1].trim() }),
  },
  // ── CALCULATE ROI (2 patterns) ──
  {
    pattern: /^(?:calculate|what(?:'s| is) the) ROI (?:for|on|at) (.+)$/i,
    intent: "calculate_roi",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  {
    pattern: /^(?:run|do) (?:a )?(?:ROI|return|investment) (?:analysis|calculation|calc)$/i,
    intent: "calculate_roi",
    extractEntities: () => ({}),
  },
  // ── SEND ALERT / MESSAGE (2 patterns) ──
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

  // ── START FILE / DOCUMENT CHECKLIST (6 patterns) ──
  {
    pattern: /^(?:start|open|create) (?:a )?(?:new )?(?:file|listing|listing file) (?:for|at|on) (.+)$/i,
    intent: "start_file",
    extractEntities: (m) => ({ address: m[1].trim(), fileType: "listing" }),
  },
  {
    pattern: /^(?:start|open|create) (?:a )?(?:new )?(?:buyer file|buyer) (?:for|named?) (.+)$/i,
    intent: "start_file",
    extractEntities: (m) => ({ buyer_name: m[1].trim(), fileType: "buyer" }),
  },
  {
    pattern: /^(?:what|which) (?:docs?|documents?) (?:am i|are we|do i) (?:missing|need) (?:for|on) (.+)$/i,
    intent: "check_docs",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  {
    pattern: /^(?:what|which) (?:docs?|documents?) (?:am i|are we|do i) (?:missing|need)$/i,
    intent: "check_docs",
    extractEntities: () => ({}),
  },
  {
    pattern: /^(?:fill|auto.?fill|populate) (?:the )?(?:mls|listing|paragon) (?:for|at|on) (.+)$/i,
    intent: "fill_mls",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
  {
    pattern: /^(?:generate|create) (?:the )?(?:mls|listing) (?:input )?sheet (?:for|at|on) (.+)$/i,
    intent: "fill_mls",
    extractEntities: (m) => ({ address: m[1].trim() }),
  },
]

// ─── MID-COMMAND CORRECTION DETECTION ───────────────────────────────────────
// If user says "no wait / actually / scratch that / I meant", take only the
// text after the last correction signal.
const CORRECTION_SIGNALS = /(?:no[, ]+wait|wait[, ]+no|actually|i meant|scratch that|never mind|no no|strike that)\s*,?\s*/i

export function extractCorrectedCommand(transcript: string): string {
  const parts = transcript.split(CORRECTION_SIGNALS)
  return parts[parts.length - 1].trim() || transcript.trim()
}

function tryFastPath(normalized: string): { intent: string; entities: Record<string, string> } | null {
  for (const matcher of FAST_MATCHERS) {
    const match = normalized.match(matcher.pattern)
    if (match) return { intent: matcher.intent, entities: matcher.extractEntities(match) }
  }
  return null
}

// ─── TRANSACTION MATCHER ────────────────────────────────────────────────────

/**
 * Improved transaction matching: exact > starts-with > contains.
 * Returns best single match, or null.
 */
export async function findTransaction(userId: string, addressQuery: string) {
  if (!addressQuery) return null

  const query = addressQuery.trim()

  // 1. Try exact match (case-insensitive)
  const exact = await prisma.transaction.findFirst({
    where: { userId, propertyAddress: { equals: query, mode: "insensitive" } },
  })
  if (exact) return exact

  // 2. Try starts-with (e.g., "123 Main" matches "123 Main St, Baton Rouge")
  const startsWith = await prisma.transaction.findFirst({
    where: { userId, propertyAddress: { startsWith: query, mode: "insensitive" } },
  })
  if (startsWith) return startsWith

  // 3. Try contains (fuzzy fallback)
  const contains = await prisma.transaction.findMany({
    where: { userId, propertyAddress: { contains: query, mode: "insensitive" } },
    take: 2,
  })

  // Only return if exactly 1 match — ambiguous if multiple
  if (contains.length === 1) return contains[0]
  if (contains.length > 1) return null // ambiguous

  // 4. Try matching by street number only
  const streetNum = query.match(/^(\d+)\b/)?.[1]
  if (streetNum) {
    const byNumber = await prisma.transaction.findMany({
      where: { userId, propertyAddress: { startsWith: streetNum, mode: "insensitive" } },
      take: 2,
    })
    if (byNumber.length === 1) return byNumber[0]
  }

  return null
}

// ─── CONTEXT LOADER ─────────────────────────────────────────────────────────

async function loadContext(userId: string) {
  // Single query: last 3 commands + most recent transaction
  const [recentCommands, lastTxn] = await Promise.all([
    prisma.voiceCommand.findMany({
      where: { userId, status: { in: ["completed", "executed"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { rawTranscript: true, parsedIntent: true, transactionId: true },
    }),
    prisma.transaction.findFirst({
      where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, propertyAddress: true, status: true },
    }),
  ])

  let lastTxnContext = lastTxn
    ? `Last transaction: ${lastTxn.propertyAddress} (${lastTxn.status})`
    : ""

  // Check if recent command referenced a different transaction
  const recentTxnId = recentCommands.find(c => c.transactionId)?.transactionId
  if (recentTxnId && recentTxnId !== lastTxn?.id) {
    const refTxn = await prisma.transaction.findUnique({
      where: { id: recentTxnId },
      select: { propertyAddress: true, status: true },
    })
    if (refTxn) {
      lastTxnContext = `Last discussed: ${refTxn.propertyAddress} (${refTxn.status})`
    }
  }

  const recentCmds = recentCommands.map(c => `"${c.rawTranscript}"`).join(", ")

  return {
    contextHint: [lastTxnContext, recentCmds ? `Recent: ${recentCmds}` : ""].filter(Boolean).join("\n"),
    lastTransactionId: recentTxnId || lastTxn?.id || null,
  }
}

// ─── CLAUDE CLASSIFICATION ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are AIRE, an AI real estate assistant for Baton Rouge, Louisiana.
Parse voice commands into intent + entities. Be fast and precise.

INTENTS: create_transaction, create_addendum, check_deadlines, update_status,
show_pipeline, calculate_roi, send_alert, market_analysis, add_party,
schedule_closing, send_document, run_compliance, write_contract, start_file,
check_docs, fill_mls, needs_clarification

start_file: user wants to start a new file/listing/buyer file. Extract address or buyer name.
check_docs: user wants to know what documents are missing for a transaction.
fill_mls: user wants to auto-fill or generate the MLS input sheet for a listing.

write_contract: user wants to write/create/draft a purchase agreement, PA, or contract.
Examples: "write PA for 123 Main", "draft purchase agreement", "write contract for the Smith deal"

ENTITY KEYS: address, city, price, date, buyer_name, buyer_email, buyer_phone,
seller_name, seller_email, seller_phone, document_type, status, description,
mls_number, rent, repair_items, addendum_text, earnest_money, financing_type,
inspection_days, closing_date, title_company, parish, zip

For write_contract, extract ALL deal fields mentioned: address, buyer_name, seller_name,
price, earnest_money, closing_date, financing_type, inspection_days, title_company, parish.
Example: "write a contract for 554 Avenue F, buyer is Gavin Shaw, price is 295000" →
entities: {address: "554 Avenue F", buyer_name: "Gavin Shaw", price: "295000"}

MULTI-TURN: If context mentions "Last discussed: [address]" and the user's command
references "it", "that deal", "this one", "the same property", or omits an address
for an intent that needs one (add_party, update_status, check_deadlines on a specific deal,
write_contract, create_addendum), use the last discussed address as the implicit address.

Return ONLY JSON (no markdown):
{"intent":"...","entities":{...},"response":"natural reply","action":"button label or null","confidence":0.0-1.0,"clarification_options":["..."]}

Louisiana terms: "Act of Sale" not "closing", "parish" not "county".
If ambiguous with no context, return needs_clarification with helpful options.`

async function classifyWithClaude(
  transcript: string,
  normalized: string,
  contextHint: string
): Promise<{
  intent: string
  entities: Record<string, string>
  response: string
  action: string | null
  confidence: number
  clarificationOptions?: string[]
}> {
  const userMsg = `"${transcript}"${normalized !== transcript.toLowerCase().trim() ? `\n(normalized: "${normalized}")` : ""}${contextHint ? `\n${contextHint}` : ""}`

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512, // reduced from 1024 for speed
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMsg }],
  })

  const text = res.content[0]?.type === "text" ? res.content[0].text : ""

  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    const parsed = JSON.parse(cleaned)
    return {
      intent: parsed.intent || "needs_clarification",
      entities: parsed.entities || {},
      response: parsed.response || "I heard you but couldn't understand.",
      action: parsed.action || null,
      confidence: parsed.confidence || 0,
      clarificationOptions: parsed.clarification_options,
    }
  } catch {
    return {
      intent: "needs_clarification",
      entities: {},
      response: "I heard you but couldn't quite understand. Could you rephrase?",
      action: null,
      confidence: 0,
      clarificationOptions: ["Try: 'Show my pipeline'", "Try: 'Check deadlines'"],
    }
  }
}

// ─── MAIN PIPELINE ──────────────────────────────────────────────────────────

export async function runVoicePipeline(input: PipelineInput): Promise<PipelineResult> {
  const pipelineStart = Date.now()

  // Step 1: Normalize (< 1ms)
  // Strip mid-command corrections first — "update status, no wait, check deadlines for Oak" → "check deadlines for Oak"
  const t0 = Date.now()
  const corrected = extractCorrectedCommand(input.transcript)
  const normalized = normalizeTranscript(corrected)
  const normalizeMs = Date.now() - t0

  // Step 2: Create VoiceCommand record immediately
  const voiceCommand = await prisma.voiceCommand.create({
    data: {
      userId: input.userId,
      rawTranscript: input.transcript,
      status: "processing",
    },
  })

  // Step 3: Try fast-path
  const fastResult = tryFastPath(normalized)
  let intent: string
  let entities: Record<string, string>
  let response: string
  let action: string | null
  let confidence: number
  let clarificationOptions: string[] | undefined
  let classifyMs: number

  // Intents that operate on a specific transaction and benefit from multi-turn context
  const ADDRESS_INTENTS = new Set([
    "add_party", "update_status", "check_deadlines", "write_contract",
    "create_addendum", "send_document", "schedule_closing", "calculate_roi",
  ])

  if (fastResult) {
    // Fast path — no Claude needed
    classifyMs = 0
    intent = fastResult.intent
    entities = fastResult.entities
    confidence = 0.95
    action = intent.replace(/_/g, " ")
    response = `Got it — ${action}.`
    clarificationOptions = undefined
  } else {
    // Step 4: Parallel context load + classify
    const t1 = Date.now()
    const [context, classification] = await Promise.all([
      loadContext(input.userId),
      classifyWithClaude(input.transcript, normalized, ""), // initial call without context
    ])

    // If low confidence and we have context, retry with context
    if (classification.confidence < 0.7 && context.contextHint) {
      const retried = await classifyWithClaude(input.transcript, normalized, context.contextHint)
      if (retried.confidence > classification.confidence) {
        Object.assign(classification, retried)
      }
    }

    classifyMs = Date.now() - t1
    intent = classification.intent
    entities = classification.entities
    response = classification.response
    action = classification.action
    confidence = classification.confidence
    clarificationOptions = classification.clarificationOptions
  }

  // Step 4b: Multi-turn implicit entity resolution
  // If the intent needs an address but none was provided, try to inherit from last command.
  // Also merge entities from the previous command when they share the same intent
  // (e.g., "write a contract" → "the address is 554 Avenue F" → "buyer is Gavin Shaw").
  if (ADDRESS_INTENTS.has(intent)) {
    const lastCmd = await prisma.voiceCommand.findFirst({
      where: { userId: input.userId, status: { in: ["completed", "executed"] } },
      orderBy: { createdAt: "desc" },
      select: { transactionId: true, parsedIntent: true, parsedEntities: true },
    })

    // Merge entities from previous command if same intent and within session window
    if (lastCmd?.parsedIntent === intent && lastCmd.parsedEntities) {
      const prevEntities = lastCmd.parsedEntities as Record<string, string>
      // Previous entities fill gaps — current command takes priority
      for (const [key, value] of Object.entries(prevEntities)) {
        if (!entities[key] && value) {
          entities[key] = value
        }
      }
      if (!entities.address && prevEntities.address) {
        response = response.replace(/\.$/, ` (using ${prevEntities.address}).`)
      }
    }

    // If still no address, inherit from last command's transaction
    if (!entities.address && lastCmd?.transactionId) {
      const txn = await prisma.transaction.findUnique({
        where: { id: lastCmd.transactionId },
        select: { propertyAddress: true },
      })
      if (txn) {
        entities.address = txn.propertyAddress
        response = response.replace(/\.$/, ` (using ${txn.propertyAddress}).`)
      }
    }
  }

  // Step 5: Update voice command with classification
  await prisma.voiceCommand.update({
    where: { id: voiceCommand.id },
    data: {
      parsedIntent: intent,
      parsedEntities: entities,
      confidence,
      result: { intent, entities, response, action, confidence },
      status: intent === "needs_clarification" ? "clarification_needed" : "completed",
    },
  })

  // Step 5b: Generate deterministic English preview for mutating intents
  const englishPreview = generateEnglishPreview(intent, entities)
  const requiresConfirmation = requiresPreviewConfirmation(intent)

  const result: PipelineResult = {
    voiceCommandId: voiceCommand.id,
    intent,
    entities,
    response,
    action,
    confidence,
    needsClarification: intent === "needs_clarification",
    clarificationOptions,
    englishPreview,
    requiresConfirmation,
    timing: {
      normalizeMs,
      classifyMs,
      executeMs: 0,
      totalMs: Date.now() - pipelineStart,
    },
  }

  console.log(`🎙️ Voice: "${input.transcript}" → ${intent} (${confidence}) [${classifyMs}ms classify, ${result.timing.totalMs}ms total]`)

  return result
}
