/**
 * Transaction Templates — defines the document checklist + TC tasks
 * for each transaction type. When an agent creates a new deal and picks
 * a template, AIRE auto-generates the full checklist.
 */

export interface ChecklistItem {
  name: string
  status: "REQUIRED" | "OPTIONAL"
  category: "purchase" | "listing" | "closing" | "marketing" | "compliance"
}

export interface TCTask {
  name: string
  category: "pre-listing" | "under-contract" | "closing" | "post-closing"
}

export interface TransactionTemplate {
  id: string
  label: string
  type: "BUYING" | "LISTING" | "OTHER"
  description: string
  documents: ChecklistItem[]
  tasks: TCTask[]
}

// ── Reve Realtors / LREC document checklists ──

// Only compliance-required documents — nothing extra, no confusion
const COMMON_PURCHASE_DOCS: ChecklistItem[] = [
  { name: "Residential Agreement to Buy or Sell", status: "REQUIRED", category: "purchase" },
  { name: "Property Disclosure", status: "REQUIRED", category: "compliance" },
  { name: "Lead Paint Disclosure", status: "REQUIRED", category: "compliance" },
  { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
  { name: "Inspections & Due Diligence Notice", status: "REQUIRED", category: "compliance" },
  { name: "Copy of Deposit Check or Wire", status: "REQUIRED", category: "purchase" },
]

const COMMON_LISTING_DOCS: ChecklistItem[] = [
  { name: "Listing Agreement", status: "REQUIRED", category: "listing" },
  { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
  { name: "Property Disclosure (LREC)", status: "REQUIRED", category: "compliance" },
  { name: "Lead Paint Disclosure", status: "REQUIRED", category: "compliance" },
]

const CLOSING_DOCS: ChecklistItem[] = [
  { name: "Signed CD or HUD", status: "REQUIRED", category: "closing" },
  { name: "Closing Information", status: "REQUIRED", category: "closing" },
  { name: "Copy of Commission Check", status: "REQUIRED", category: "closing" },
]

// ── TC Task lists by transaction type ──

const PURCHASE_TASKS: TCTask[] = [
  { name: "Submit executed contract to office", category: "under-contract" },
  { name: "Verify deposit delivered within 72 hours", category: "under-contract" },
  { name: "Order title work", category: "under-contract" },
  { name: "Schedule home inspection", category: "under-contract" },
  { name: "Follow up on appraisal", category: "under-contract" },
  { name: "Confirm financing approval", category: "under-contract" },
  { name: "Review inspection response deadline", category: "under-contract" },
  { name: "Confirm clear-to-close from lender", category: "closing" },
  { name: "Schedule closing date/time/location", category: "closing" },
  { name: "Confirm utilities transfer", category: "closing" },
  { name: "Final walkthrough scheduled", category: "closing" },
  { name: "Collect commission check", category: "post-closing" },
  { name: "Update MLS status to Sold", category: "post-closing" },
  { name: "Send closing gift", category: "post-closing" },
]

const LISTING_TASKS: TCTask[] = [
  { name: "Create CMA", category: "pre-listing" },
  { name: "Create Listing Presentation", category: "pre-listing" },
  { name: "Meet with Clients", category: "pre-listing" },
  { name: "Get Signed Paperwork", category: "pre-listing" },
  { name: "Add Lockbox", category: "pre-listing" },
  { name: "Do a Facebook Live Video", category: "pre-listing" },
  { name: "Order Photographer", category: "pre-listing" },
  { name: "Get Payment Flyer from Lender", category: "pre-listing" },
  { name: "Submit Listing Paperwork to Office Admin", category: "pre-listing" },
  { name: "Put up Sign", category: "pre-listing" },
  { name: "Upload Photos to MLS", category: "pre-listing" },
  { name: "Schedule Open House", category: "pre-listing" },
  { name: "Create social media posts", category: "pre-listing" },
  { name: "Follow up with showing feedback", category: "under-contract" },
  { name: "Update MLS status on contract", category: "under-contract" },
]

// ── Templates ──

export const TRANSACTION_TEMPLATES: TransactionTemplate[] = [
  {
    id: "buying-single-family",
    label: "Buying - Single Family",
    type: "BUYING",
    description: "Standard residential purchase",
    documents: [...COMMON_PURCHASE_DOCS, ...CLOSING_DOCS],
    tasks: PURCHASE_TASKS,
  },
  {
    id: "buying-condo",
    label: "Buying - Condo",
    type: "BUYING",
    description: "Condo or townhome purchase",
    documents: [
      ...COMMON_PURCHASE_DOCS,
      { name: "HOA Documents", status: "REQUIRED", category: "purchase" },
      ...CLOSING_DOCS,
    ],
    tasks: PURCHASE_TASKS,
  },
  {
    id: "buying-multi-family",
    label: "Buying - Multi Family",
    type: "BUYING",
    description: "Duplex, triplex, or fourplex purchase",
    documents: [
      ...COMMON_PURCHASE_DOCS,
      { name: "Rent Roll / Lease Agreements", status: "REQUIRED", category: "purchase" },
      ...CLOSING_DOCS,
    ],
    tasks: PURCHASE_TASKS,
  },
  {
    id: "buying-new-construction",
    label: "Buying - New Construction",
    type: "BUYING",
    description: "New build purchase",
    documents: [...COMMON_PURCHASE_DOCS, ...CLOSING_DOCS],
    tasks: PURCHASE_TASKS,
  },
  {
    id: "buying-vacant-land",
    label: "Buying - Vacant Land",
    type: "BUYING",
    description: "Lot or land purchase",
    documents: [
      { name: "Land Purchase Agreement", status: "REQUIRED", category: "purchase" },
      { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
      { name: "Copy of Deposit Check or Wire", status: "REQUIRED", category: "purchase" },
      ...CLOSING_DOCS,
    ],
    tasks: PURCHASE_TASKS,
  },
  {
    id: "listing-1-4-family",
    label: "Listing - 1-4 Family",
    type: "LISTING",
    description: "Standard residential listing",
    documents: [...COMMON_LISTING_DOCS, ...CLOSING_DOCS],
    tasks: LISTING_TASKS,
  },
  {
    id: "listing-vacant-land",
    label: "Listing - Vacant Land",
    type: "LISTING",
    description: "Lot or land listing",
    documents: [
      { name: "Listing Agreement", status: "REQUIRED", category: "listing" },
      { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
      ...CLOSING_DOCS,
    ],
    tasks: LISTING_TASKS,
  },
  {
    id: "listing-new-construction",
    label: "Listing - New Construction",
    type: "LISTING",
    description: "New build listing",
    documents: [...COMMON_LISTING_DOCS, ...CLOSING_DOCS],
    tasks: LISTING_TASKS,
  },
  {
    id: "listing-lease",
    label: "Listing - Lease",
    type: "LISTING",
    description: "Rental / lease listing",
    documents: [
      { name: "Lease Agreement", status: "REQUIRED", category: "listing" },
      { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
      { name: "Lead Paint Disclosure", status: "REQUIRED", category: "compliance" },
    ],
    tasks: [
      { name: "Create listing in MLS", category: "pre-listing" },
      { name: "Order Photographer", category: "pre-listing" },
      { name: "Screen tenant applications", category: "under-contract" },
      { name: "Collect security deposit", category: "closing" },
      { name: "Execute lease", category: "closing" },
    ],
  },
  {
    id: "buyer-broker-agreement",
    label: "Buyer Broker Agreement",
    type: "OTHER",
    description: "Buyer representation agreement only",
    documents: [
      { name: "Buyer Broker Agreement", status: "REQUIRED", category: "purchase" },
      { name: "Agency Disclosure Form", status: "REQUIRED", category: "compliance" },
    ],
    tasks: [],
  },
]

export function getTemplate(id: string): TransactionTemplate | undefined {
  return TRANSACTION_TEMPLATES.find(t => t.id === id)
}

export function getTemplatesByType(type: "BUYING" | "LISTING" | "OTHER"): TransactionTemplate[] {
  return TRANSACTION_TEMPLATES.filter(t => t.type === type)
}
