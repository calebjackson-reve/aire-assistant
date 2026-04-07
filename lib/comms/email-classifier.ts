/**
 * AIRE Email Classifier — 3-Tier Routing
 *
 * Classifies inbound emails into one of three buckets:
 *   - deal_related  → matches an active transaction (address, party name, MLS)
 *   - work_related  → real estate work, but no specific deal match
 *   - personal      → everything else
 *
 * TIER 1 (this file): Regex + DB context lookup. Free. Instant. Pure function.
 * TIER 2 (this file): Claude Haiku fallback when Tier 1 returns null. ~$0.0005/email.
 * TIER 3 (NOT HERE):  Sonnet draft-reply generation happens elsewhere, ONLY
 *                     when the user clicks "Draft Reply" on a deal_related email.
 *                     This classifier never invokes Sonnet. Do not conflate the layers.
 *
 * Design rules:
 *   - Pure function. No DB writes inside. Callers write the result.
 *   - No Tier 2 call if Tier 1 produces a confident answer.
 *   - Context (active txns, vendors) is passed in, not loaded here, so this
 *     stays testable and side-effect-free.
 */

import Anthropic from "@anthropic-ai/sdk"

// ─── Types ──────────────────────────────────────────────────────────────────

export type EmailCategory = "deal_related" | "work_related" | "personal"

export interface EmailInput {
  from: string // "Name <addr@domain.com>" or "addr@domain.com"
  subject: string
  body: string // plain text body (or snippet)
}

export interface TransactionContext {
  id: string
  propertyAddress: string
  propertyCity?: string | null
  mlsNumber?: string | null
  buyerName?: string | null
  buyerEmail?: string | null
  sellerName?: string | null
  sellerEmail?: string | null
  lenderName?: string | null
  titleCompany?: string | null
}

export interface ClassifierContext {
  activeTransactions: TransactionContext[]
  vendorEmails?: string[] // e.g. preferred inspectors, title, appraisers
  /** extra sender domains that should always classify as work_related */
  workDomains?: string[]
}

export interface ClassificationResult {
  category: EmailCategory
  confidence: number // 0..1
  tier: 1 | 2
  reason: string
  matchedTransactionId?: string
  matchedSignals?: string[]
}

// ─── Config (extensible) ────────────────────────────────────────────────────

/**
 * Seed list of sender-domain suffixes typical of Louisiana real estate work.
 * Not comprehensive — extend as we observe real traffic. Must be lowercase.
 */
export const DEFAULT_WORK_DOMAINS: string[] = [
  // Brokerages (add as encountered)
  "reverealtors.com",
  "kw.com",
  "kellerwilliams.com",
  "remax.com",
  "cbunited.com",
  "century21.com",
  "exprealty.com",
  // Title / closing
  "louisianatitle.com",
  "firstam.com",
  "stewart.com",
  "oldrepublictitle.com",
  "fnf.com",
  // Lenders
  "rocketmortgage.com",
  "guildmortgage.com",
  "chase.com",
  "wellsfargo.com",
  "bankofamerica.com",
  // MLS / data
  "gbrmls.com",
  "gbrar.com",
  "flexmls.com",
  "matrix.com",
  "corelogic.com",
  // LREC / state
  "lrec.state.la.us",
  "lrec.la.gov",
]

/** Case-insensitive RE keyword bank. */
const RE_KEYWORDS: string[] = [
  "mls",
  "lrec",
  "lender",
  "title company",
  "title work",
  "escrow",
  "earnest money",
  "appraisal",
  "appraiser",
  "inspection",
  "inspector",
  "closing",
  "closing date",
  "offer",
  "counter offer",
  "counteroffer",
  "addendum",
  "purchase agreement",
  "disclosure",
  "commission",
  "hud-1",
  "alta",
  "parish",
  "louisiana",
  "broker",
  "brokerage",
  "listing",
  "listing agent",
  "showing",
  "walkthrough",
  "walk-through",
  "appraisal contingency",
  "financing contingency",
  "termite",
  "wdi",
  "act of sale",
  "notary",
  "home warranty",
  "survey",
  "flood zone",
  "realtor",
  "under contract",
]

/**
 * Obvious "personal / marketing / spam" keywords. Not definitive — used as a
 * soft penalty so marketing emails don't get caught by a lone "closing" word.
 */
const PERSONAL_HINTS: string[] = [
  "unsubscribe",
  "your order",
  "order confirmation",
  "shipped",
  "delivery",
  "amazon.com",
  "receipt from",
  "newsletter",
  "weekly digest",
  "password reset",
  "verify your email",
  "2-factor",
  "promo code",
  "limited time offer",
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s || "").toLowerCase()
}

function extractEmailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim().toLowerCase()
}

function extractDomain(from: string): string {
  const addr = extractEmailAddress(from)
  const at = addr.lastIndexOf("@")
  return at >= 0 ? addr.slice(at + 1) : ""
}

/**
 * Strip an address to its street-core tokens for fuzzy matching.
 * "1234 Guice Dr, Baton Rouge, LA 70808" → ["1234", "guice", "dr"]
 */
function addressTokens(addr: string): string[] {
  return norm(addr)
    .replace(/[,.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !["la", "usa", "baton", "rouge"].includes(t))
}

/**
 * Does `haystack` contain the address meaningfully? We require the street
 * number AND at least one street-name token (e.g. "5834" + "guice").
 */
function haystackMatchesAddress(haystack: string, address: string): boolean {
  const h = norm(haystack)
  const toks = addressTokens(address)
  const num = toks.find((t) => /^\d+$/.test(t))
  const names = toks.filter((t) => !/^\d+$/.test(t))
  if (!num || names.length === 0) return false
  if (!h.includes(num)) return false
  return names.some((n) => n.length >= 3 && h.includes(n))
}

function haystackMatchesName(haystack: string, name: string | null | undefined): string | null {
  if (!name) return null
  const h = norm(haystack)
  // Match on last name (at minimum) to reduce false positives on "John"
  const parts = norm(name).split(/\s+/).filter((p) => p.length >= 3)
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  if (h.includes(last)) return name
  return null
}

// ─── Tier 1: Deterministic ──────────────────────────────────────────────────

export function classifyTier1(
  email: EmailInput,
  ctx: ClassifierContext
): ClassificationResult | null {
  const haystack = `${email.subject}\n${email.body}`
  const senderAddr = extractEmailAddress(email.from)
  const senderDomain = extractDomain(email.from)
  const signals: string[] = []

  // ── 1a: Known party email → deal_related
  for (const txn of ctx.activeTransactions) {
    const partyEmails = [txn.buyerEmail, txn.sellerEmail]
      .filter(Boolean)
      .map((e) => norm(e!))
    if (partyEmails.includes(senderAddr)) {
      signals.push(`sender is known party on ${txn.propertyAddress}`)
      return {
        category: "deal_related",
        confidence: 0.95,
        tier: 1,
        reason: `Sender ${senderAddr} is a buyer/seller on transaction ${txn.propertyAddress}`,
        matchedTransactionId: txn.id,
        matchedSignals: signals,
      }
    }
  }

  // ── 1b: Address / MLS / party-name in subject or body → deal_related
  for (const txn of ctx.activeTransactions) {
    if (txn.mlsNumber && haystack.includes(txn.mlsNumber)) {
      signals.push(`MLS# ${txn.mlsNumber}`)
      return {
        category: "deal_related",
        confidence: 0.95,
        tier: 1,
        reason: `MLS number ${txn.mlsNumber} referenced`,
        matchedTransactionId: txn.id,
        matchedSignals: signals,
      }
    }
    if (haystackMatchesAddress(haystack, txn.propertyAddress)) {
      signals.push(`address "${txn.propertyAddress}"`)
      return {
        category: "deal_related",
        confidence: 0.9,
        tier: 1,
        reason: `Property address "${txn.propertyAddress}" referenced`,
        matchedTransactionId: txn.id,
        matchedSignals: signals,
      }
    }
    const nameHit =
      haystackMatchesName(haystack, txn.buyerName) ||
      haystackMatchesName(haystack, txn.sellerName)
    if (nameHit) {
      // Name alone is weaker than address — require an RE keyword too
      if (RE_KEYWORDS.some((k) => norm(haystack).includes(k))) {
        signals.push(`party name "${nameHit}" + RE keyword`)
        return {
          category: "deal_related",
          confidence: 0.85,
          tier: 1,
          reason: `Party name "${nameHit}" + RE keyword for ${txn.propertyAddress}`,
          matchedTransactionId: txn.id,
          matchedSignals: signals,
        }
      }
    }
  }

  // ── 1c: Known vendor email → work_related
  const vendorEmails = (ctx.vendorEmails || []).map(norm).filter(Boolean)
  if (vendorEmails.includes(senderAddr)) {
    return {
      category: "work_related",
      confidence: 0.85,
      tier: 1,
      reason: `Sender ${senderAddr} is a known preferred vendor`,
      matchedSignals: [`vendor:${senderAddr}`],
    }
  }

  // ── 1d: Work-domain TLD → work_related
  const workDomains = [...(ctx.workDomains || []), ...DEFAULT_WORK_DOMAINS]
  if (senderDomain && workDomains.some((d) => senderDomain.endsWith(d))) {
    return {
      category: "work_related",
      confidence: 0.8,
      tier: 1,
      reason: `Sender domain ${senderDomain} matches real estate work domain`,
      matchedSignals: [`domain:${senderDomain}`],
    }
  }

  // ── 1e: RE keyword density → work_related
  const h = norm(haystack)
  const keywordHits = RE_KEYWORDS.filter((k) => h.includes(k))
  const personalHits = PERSONAL_HINTS.filter((k) => h.includes(k))

  if (keywordHits.length >= 2 && personalHits.length === 0) {
    return {
      category: "work_related",
      confidence: 0.8,
      tier: 1,
      reason: `Matched ${keywordHits.length} RE keywords: ${keywordHits.slice(0, 4).join(", ")}`,
      matchedSignals: keywordHits.slice(0, 6),
    }
  }

  // ── 1f: Strong personal signal with zero RE keywords → personal
  if (personalHits.length >= 1 && keywordHits.length === 0) {
    return {
      category: "personal",
      confidence: 0.8,
      tier: 1,
      reason: `Personal/marketing signal: ${personalHits[0]}`,
      matchedSignals: personalHits,
    }
  }

  // Ambiguous → let Tier 2 decide.
  return null
}

// ─── Tier 2: Haiku fallback ─────────────────────────────────────────────────

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

const TIER2_MODEL = "claude-haiku-4-5-20251001"

/**
 * Ask Claude Haiku to classify. Input budget capped at subject + 500 chars
 * body so every call stays ~300 input / ~100 output tokens (~$0.0005).
 */
export async function classifyTier2(
  email: EmailInput
): Promise<ClassificationResult> {
  const trimmedBody = (email.body || "").slice(0, 500)
  const prompt = `You classify inbound emails for a Louisiana REALTOR.

Return ONLY compact JSON: {"category":"deal_related|work_related|personal","confidence":0.0-1.0,"reason":"short phrase"}

Rules:
- deal_related: references a specific property deal, buyer, seller, or active transaction
- work_related: real estate business (MLS, lender, title, inspector, LREC, broker, showing, offer, etc.) but no specific deal tied
- personal: family, marketing, newsletters, spam, receipts, anything non-RE

From: ${email.from}
Subject: ${email.subject}
Body: ${trimmedBody}`

  try {
    const res = await getAnthropic().messages.create({
      model: TIER2_MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    })

    const text =
      res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") || ""

    // Extract JSON object
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error("No JSON in Haiku response")
    const parsed = JSON.parse(m[0]) as {
      category: EmailCategory
      confidence: number
      reason: string
    }

    if (!["deal_related", "work_related", "personal"].includes(parsed.category)) {
      throw new Error(`Invalid category: ${parsed.category}`)
    }

    return {
      category: parsed.category,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.6)),
      tier: 2,
      reason: parsed.reason || "Haiku classification",
    }
  } catch (err) {
    // Safe default: when in doubt, treat as personal so we don't burn Sonnet
    // downstream on garbage. Low confidence flags for manual review.
    return {
      category: "personal",
      confidence: 0.3,
      tier: 2,
      reason: `Tier 2 fallback (error: ${err instanceof Error ? err.message : String(err)})`,
    }
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Pure classification entry point. Tries Tier 1, falls through to Tier 2.
 * No side effects. Callers are responsible for persisting the result.
 */
export async function classifyEmail(
  email: EmailInput,
  ctx: ClassifierContext
): Promise<ClassificationResult> {
  const t1 = classifyTier1(email, ctx)
  if (t1) return t1
  return classifyTier2(email)
}
