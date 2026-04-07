/**
 * AIRE Transaction Document Checklists
 * Required documents by transaction type and phase.
 * Used by voice commands ("start a file", "what docs am I missing?")
 * and the TransactionDetail Documents tab.
 */

export interface ChecklistItem {
  name: string
  category: string
  lrecForm?: string
  required: boolean
  description?: string
}

export type TransactionPhase =
  | "pre_listing"
  | "active_listing"
  | "new_buyer"
  | "under_contract"
  | "closing"

export type TransactionSide = "listing" | "buyer" | "dual"

// ─── Pre-Listing (Seller Side) ──────────────────────────────────
const PRE_LISTING: ChecklistItem[] = [
  { name: "Listing Agreement", category: "listing", lrecForm: "LREC-001", required: true, description: "Exclusive right to sell agreement between agent and seller" },
  { name: "Property Disclosure", category: "disclosure", lrecForm: "PDD", required: true, description: "Seller's disclosure of known property defects" },
  { name: "Lead-Based Paint Disclosure", category: "disclosure", required: false, description: "Required for homes built before 1978" },
  { name: "Agency Disclosure", category: "disclosure", lrecForm: "LREC-ADR", required: true, description: "Discloses agent's role (buyer's agent, seller's agent, dual)" },
  { name: "Seller's Net Sheet", category: "financial", required: false, description: "Estimated proceeds after commissions, fees, and payoffs" },
  { name: "MLS Input Sheet", category: "listing", required: true, description: "All property data for Paragon MLS listing entry" },
  { name: "Property Photos", category: "media", required: true, description: "Professional photos for MLS and marketing" },
  { name: "Wood Destroying Insect Report", category: "inspection", lrecForm: "GBRAR-WDI", required: true, description: "GBRAR-required termite and pest inspection" },
  { name: "Survey", category: "legal", required: false, description: "Property boundary survey if available" },
  { name: "HOA Documents", category: "legal", required: false, description: "Required if property is in an HOA" },
]

// ─── New Buyer (Buyer Side) ─────────────────────────────────────
const NEW_BUYER: ChecklistItem[] = [
  { name: "Buyer Agency Agreement", category: "agreement", lrecForm: "LREC-002", required: true, description: "Exclusive buyer representation agreement" },
  { name: "Agency Disclosure", category: "disclosure", lrecForm: "LREC-ADR", required: true, description: "Discloses agent's role in the transaction" },
  { name: "Pre-Approval Letter", category: "financial", required: true, description: "Lender pre-approval for buyer's purchasing power" },
  { name: "Proof of Funds", category: "financial", required: false, description: "Required for cash purchases" },
  { name: "Buyer Information Sheet", category: "intake", required: true, description: "Buyer's preferences, timeline, and contact info" },
]

// ─── Under Contract (Both Sides) ────────────────────────────────
const UNDER_CONTRACT: ChecklistItem[] = [
  { name: "Purchase Agreement", category: "contract", lrecForm: "LREC-101", required: true, description: "Fully executed residential purchase agreement" },
  { name: "All Addenda", category: "contract", required: true, description: "Any addenda to the purchase agreement" },
  { name: "Earnest Money Receipt", category: "financial", required: true, description: "Proof of earnest money deposit" },
  { name: "Inspection Report", category: "inspection", required: true, description: "Property inspection findings" },
  { name: "Inspection Response", category: "inspection", required: false, description: "Buyer's repair request or acceptance" },
  { name: "Appraisal", category: "financial", required: true, description: "Lender-ordered property appraisal" },
  { name: "Title Commitment", category: "legal", required: true, description: "Title company's commitment to insure" },
  { name: "Survey", category: "legal", required: true, description: "Current boundary survey" },
  { name: "Termite Letter", category: "inspection", required: true, description: "Clear termite inspection or treatment letter" },
  { name: "Insurance Binder", category: "financial", required: true, description: "Homeowner's insurance commitment" },
]

// ─── Closing ────────────────────────────────────────────────────
const CLOSING: ChecklistItem[] = [
  { name: "Closing Disclosure", category: "financial", required: true, description: "Final settlement statement with all costs" },
  { name: "Final Walkthrough Confirmation", category: "inspection", required: true, description: "Buyer confirms property condition before closing" },
  { name: "Wire Transfer Confirmation", category: "financial", required: true, description: "Proof of funds wired to title company" },
  { name: "Signed Deed", category: "legal", required: true, description: "Executed warranty deed transferring ownership" },
]

// ─── Checklist Lookup ───────────────────────────────────────────

const CHECKLISTS: Record<string, ChecklistItem[]> = {
  pre_listing: PRE_LISTING,
  active_listing: PRE_LISTING, // Same docs, listing is live
  new_buyer: NEW_BUYER,
  under_contract: UNDER_CONTRACT,
  closing: [...UNDER_CONTRACT, ...CLOSING],
}

/**
 * Get the document checklist for a transaction type/phase.
 * Returns all required and optional documents.
 */
export function getChecklist(phase: TransactionPhase): ChecklistItem[] {
  return CHECKLISTS[phase] || UNDER_CONTRACT
}

/**
 * Get the full checklist for a transaction side.
 * Listing side = pre-listing + under contract + closing.
 * Buyer side = new buyer + under contract + closing.
 */
export function getFullChecklist(side: TransactionSide): ChecklistItem[] {
  if (side === "listing") {
    return [...PRE_LISTING, ...UNDER_CONTRACT, ...CLOSING]
  }
  if (side === "buyer") {
    return [...NEW_BUYER, ...UNDER_CONTRACT, ...CLOSING]
  }
  // Dual
  return [...PRE_LISTING, ...NEW_BUYER, ...UNDER_CONTRACT, ...CLOSING]
}

/**
 * Compare uploaded documents against the checklist.
 * Returns { complete, missing, optional } lists.
 */
export function checkDocumentCompleteness(
  uploadedDocTypes: string[],
  phase: TransactionPhase
): {
  complete: ChecklistItem[]
  missing: ChecklistItem[]
  optional: ChecklistItem[]
  completionPct: number
} {
  const checklist = getChecklist(phase)
  const normalizedUploaded = uploadedDocTypes.map((t) => t.toLowerCase().replace(/[_-]/g, " "))

  const complete: ChecklistItem[] = []
  const missing: ChecklistItem[] = []
  const optional: ChecklistItem[] = []

  for (const item of checklist) {
    const normalizedName = item.name.toLowerCase()
    const normalizedCategory = item.category.toLowerCase()

    const found = normalizedUploaded.some(
      (uploaded) =>
        uploaded.includes(normalizedName) ||
        normalizedName.includes(uploaded) ||
        uploaded.includes(normalizedCategory)
    )

    if (found) {
      complete.push(item)
    } else if (item.required) {
      missing.push(item)
    } else {
      optional.push(item)
    }
  }

  const requiredTotal = checklist.filter((i) => i.required).length
  const completionPct = requiredTotal > 0
    ? Math.round((complete.filter((i) => i.required).length / requiredTotal) * 100)
    : 100

  return { complete, missing, optional, completionPct }
}
