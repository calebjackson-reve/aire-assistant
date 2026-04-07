/**
 * AIRE Voice — English Preview Layer
 *
 * Deterministic, template-based playback of what AIRE heard BEFORE any
 * mutating action fires. No LLM calls. Pure functions.
 *
 * The preview is the trust layer: agents never speak a contract into
 * existence without seeing their own words echoed back in plain English.
 */

import * as chrono from "chrono-node"

/**
 * Intents that mutate state or generate documents. The UI MUST show an
 * English preview + Accept/Edit/Cancel before calling the execute route
 * for any intent in this set.
 */
export const PREVIEW_REQUIRED_INTENTS = new Set<string>([
  "write_contract",
  "create_addendum",
  "create_transaction",
  "schedule_closing",
  "send_document",
  "send_alert",
  "update_status",
])

// ─── HELPERS ────────────────────────────────────────────────────────────────

function formatCurrency(raw: string | undefined): string | null {
  if (!raw) return null
  const cleaned = raw.toString().replace(/[^0-9.]/g, "")
  const n = parseFloat(cleaned)
  if (!isFinite(n) || n <= 0) return null
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function formatDate(raw: string | undefined): { display: string; iso: string | null } | null {
  if (!raw) return null
  const parsed = chrono.parseDate(raw, new Date(), { forwardDate: true })
  if (!parsed || isNaN(parsed.getTime())) {
    return { display: raw, iso: null }
  }
  const display = parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  // If the original string doesn't obviously contain the resolved date,
  // append the resolved date in parens so the user sees what AIRE heard.
  const showBoth = !/\b\d{1,2}\b/.test(raw) || /friday|monday|tuesday|wednesday|thursday|saturday|sunday|next|tomorrow|week|month/i.test(raw)
  return {
    display: showBoth ? `${raw} (${display})` : display,
    iso: parsed.toISOString(),
  }
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

// ─── TEMPLATES ──────────────────────────────────────────────────────────────

type PreviewBuilder = (e: Record<string, string>) => string | null

const TEMPLATES: Record<string, PreviewBuilder> = {
  write_contract: (e) => {
    const parts: string[] = []
    if (e.address) parts.push(e.address)
    const price = formatCurrency(e.price)
    if (price) parts.push(`at ${price}`)
    if (e.buyer_name) parts.push(`buyer ${titleCase(e.buyer_name)}`)
    if (e.seller_name) parts.push(`seller ${titleCase(e.seller_name)}`)
    const closing = formatDate(e.closing_date || e.date)
    if (closing) parts.push(`closing ${closing.display}`)
    const em = formatCurrency(e.earnest_money)
    if (em) parts.push(`earnest money ${em}`)

    const body = parts.length > 0
      ? `Purchase agreement for ${parts.join(", ")}`
      : "Purchase agreement (no details provided)"
    return `You said: ${body}. Is this right?`
  },

  create_addendum: (e) => {
    const addr = e.address || "the active transaction"
    const desc = e.description || e.addendum_text || e.addendum_type
    const body = desc
      ? `Create an addendum for ${addr} — ${desc}`
      : `Create an addendum for ${addr}`
    return `You said: ${body}. Is this right?`
  },

  create_transaction: (e) => {
    const parts: string[] = []
    if (e.address) parts.push(e.address)
    const price = formatCurrency(e.price)
    if (price) parts.push(`list ${price}`)
    if (e.buyer_name) parts.push(`buyer ${titleCase(e.buyer_name)}`)
    if (e.seller_name) parts.push(`seller ${titleCase(e.seller_name)}`)
    if (e.mls_number) parts.push(`MLS ${e.mls_number}`)

    const body = parts.length > 0
      ? `New transaction for ${parts.join(", ")}`
      : "New transaction (no details provided)"
    return `You said: ${body}. Confirm?`
  },

  schedule_closing: (e) => {
    const addr = e.address || "the active transaction"
    const closing = formatDate(e.date)
    const datePart = closing ? ` on ${closing.display}` : ""
    return `You said: Schedule the closing for ${addr}${datePart}. Confirm?`
  },

  send_document: (e) => {
    const doc = e.document_type || "purchase agreement"
    const recipient = e.buyer_name || e.seller_name || e.recipient || "the other party"
    const addr = e.address ? ` for ${e.address}` : ""
    return `You said: Send the ${doc}${addr} to ${titleCase(recipient)} for signature. Confirm?`
  },

  send_alert: (e) => {
    // send_alert entities from fast-path use keys like buyer_role / seller_role
    const role = e.buyer_role || e.seller_role || e.lender_role || e.title_company_role || e.agent_role
    const name = e.buyer_name || e.seller_name
    const recipient = name || role || "the other party"
    const about = e.description || e.message || "the transaction"
    return `You said: Notify ${recipient} about "${about}". Send it?`
  },

  update_status: (e) => {
    const addr = e.address || "the active transaction"
    const status = (e.status || "").toString().replace(/_/g, " ").toLowerCase()
    if (!status) return `You said: Update status for ${addr}. Confirm?`
    return `You said: Update ${addr} status to ${status}. Confirm?`
  },
}

/**
 * Generate a deterministic English playback of what AIRE heard.
 * Returns null for read-only intents that don't need confirmation.
 */
export function generateEnglishPreview(
  intent: string,
  entities: Record<string, string>
): string | null {
  if (!PREVIEW_REQUIRED_INTENTS.has(intent)) return null
  const builder = TEMPLATES[intent]
  if (!builder) return null
  try {
    return builder(entities || {})
  } catch {
    return null
  }
}

/**
 * Convenience: does the UI need to show an Accept/Edit/Cancel card for
 * this intent?
 */
export function requiresPreviewConfirmation(intent: string): boolean {
  return PREVIEW_REQUIRED_INTENTS.has(intent)
}
