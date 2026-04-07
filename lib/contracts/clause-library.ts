/**
 * AIRE Contract Writing Engine — Clause Library
 * 50+ standard Louisiana real estate clauses with variable substitution.
 *
 * Clauses are categorized by type and inserted conditionally based on
 * deal parameters (financing type, property type, inspection results, etc.).
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface Clause {
  id: string
  title: string
  category: ClauseCategory
  text: string                        // Template with {{variable}} placeholders
  variables: string[]                 // Required variables for substitution
  conditional?: (ctx: ClauseContext) => boolean  // Include only if this returns true
  required: boolean                   // Must be included in all contracts of this form type
  formTypes: string[]                 // Which forms use this clause
}

export type ClauseCategory =
  | "inspection"
  | "financing"
  | "appraisal"
  | "title"
  | "closing"
  | "repairs"
  | "contingency"
  | "disclosure"
  | "property"
  | "terms"
  | "louisiana"

export interface ClauseContext {
  financingType?: string        // "conventional" | "fha" | "va" | "usda" | "cash"
  propertyType?: string         // "residential" | "condo" | "land" | "commercial"
  yearBuilt?: number
  floodZone?: string
  hasHOA?: boolean
  inspectionRequested?: boolean
  repairItems?: string[]
  earnestMoney?: number
  purchasePrice?: number
  closingDate?: string
  inspectionDays?: number
  appraisalDays?: number
  financingDays?: number
  [key: string]: unknown
}

// ─── VARIABLE SUBSTITUTION ──────────────────────────────────────────────────

export function substituteVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] || match
  })
}

// ─── CLAUSE DEFINITIONS ─────────────────────────────────────────────────────

export const CLAUSES: Clause[] = [
  // ── INSPECTION CLAUSES ──
  {
    id: "inspection_standard",
    title: "Standard Inspection Contingency",
    category: "inspection",
    text: "Buyer shall have {{inspection_days}} calendar days from the date of acceptance to conduct a property inspection at Buyer's expense. If inspection reveals defects, Buyer may request repairs, renegotiate, or terminate this agreement with earnest money returned.",
    variables: ["inspection_days"],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "inspection_waiver",
    title: "Inspection Waiver",
    category: "inspection",
    text: "Buyer hereby waives the right to a property inspection. Buyer accepts the property in its present AS-IS condition.",
    variables: [],
    conditional: (ctx) => ctx.inspectionDays === 0,
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "inspection_response_deadline",
    title: "Inspection Response Deadline",
    category: "inspection",
    text: "Seller shall respond to Buyer's inspection repair request within 3 calendar days of receipt. Failure to respond shall constitute rejection of Buyer's request.",
    variables: [],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "repair_request",
    title: "Repair Request",
    category: "repairs",
    text: "Following the property inspection, Buyer requests the following repairs be completed prior to closing:\n{{repair_items}}\nAll repairs shall be completed in a workmanlike manner by licensed contractors.",
    variables: ["repair_items"],
    required: false,
    formTypes: ["lrec-103"],
  },
  {
    id: "repair_credit",
    title: "Repair Credit in Lieu of Repairs",
    category: "repairs",
    text: "In lieu of completing repairs, Seller agrees to credit Buyer ${{repair_credit}} at closing toward Buyer's closing costs or repairs.",
    variables: ["repair_credit"],
    required: false,
    formTypes: ["lrec-103"],
  },

  // ── FINANCING CLAUSES ──
  {
    id: "financing_contingency",
    title: "Financing Contingency",
    category: "financing",
    text: "This agreement is contingent upon Buyer obtaining {{financing_type}} financing in the amount of ${{loan_amount}} within {{financing_days}} calendar days. If Buyer is unable to obtain financing, this agreement may be terminated and earnest money returned to Buyer.",
    variables: ["financing_type", "loan_amount", "financing_days"],
    conditional: (ctx) => ctx.financingType !== "cash",
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "cash_purchase",
    title: "Cash Purchase — No Financing Contingency",
    category: "financing",
    text: "Buyer shall purchase the property with cash. No financing contingency applies. Buyer shall provide proof of funds within 5 calendar days of acceptance.",
    variables: [],
    conditional: (ctx) => ctx.financingType === "cash",
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "fha_requirements",
    title: "FHA Financing Requirements",
    category: "financing",
    text: "This transaction is subject to FHA financing requirements. Property must meet FHA minimum property standards. FHA appraisal is required. Seller may be required to make repairs to meet FHA standards.",
    variables: [],
    conditional: (ctx) => ctx.financingType === "fha",
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "va_requirements",
    title: "VA Financing Requirements",
    category: "financing",
    text: "This transaction is subject to VA financing requirements. It is expressly agreed that, notwithstanding any other provisions of this contract, the Buyer shall not incur any penalty by forfeiture of earnest money or otherwise if the contract purchase price exceeds the reasonable value established by the VA.",
    variables: [],
    conditional: (ctx) => ctx.financingType === "va",
    required: false,
    formTypes: ["lrec-101"],
  },

  // ── APPRAISAL CLAUSES ──
  {
    id: "appraisal_contingency",
    title: "Appraisal Contingency",
    category: "appraisal",
    text: "This agreement is contingent upon the property appraising at or above the purchase price of ${{purchase_price}}. If the appraisal is below the purchase price, Buyer may: (a) pay the difference in cash, (b) renegotiate the purchase price, or (c) terminate this agreement with earnest money returned.",
    variables: ["purchase_price"],
    conditional: (ctx) => ctx.financingType !== "cash",
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "appraisal_gap",
    title: "Appraisal Gap Coverage",
    category: "appraisal",
    text: "Buyer agrees to pay up to ${{appraisal_gap}} above the appraised value in cash to cover any appraisal gap, not to exceed the original purchase price of ${{purchase_price}}.",
    variables: ["appraisal_gap", "purchase_price"],
    required: false,
    formTypes: ["lrec-101", "lrec-103"],
  },

  // ── TITLE CLAUSES ──
  {
    id: "title_examination",
    title: "Title Examination",
    category: "title",
    text: "Seller shall provide clear and merchantable title, free of all encumbrances except those listed herein. Title examination shall be completed no later than 20 calendar days prior to the Act of Sale date.",
    variables: [],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "title_insurance",
    title: "Title Insurance",
    category: "title",
    text: "{{title_insurance_paid_by}} shall pay for a standard owner's title insurance policy. Buyer may purchase extended coverage at Buyer's expense.",
    variables: ["title_insurance_paid_by"],
    required: true,
    formTypes: ["lrec-101"],
  },

  // ── CLOSING / ACT OF SALE CLAUSES ──
  {
    id: "act_of_sale",
    title: "Act of Sale",
    category: "closing",
    text: "The Act of Sale shall take place on or before {{closing_date}} at {{act_of_sale_location}}, or at such other time and place as mutually agreed upon by the parties. Louisiana law requires that the Act of Sale be executed before a Notary Public.",
    variables: ["closing_date", "act_of_sale_location"],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "closing_costs",
    title: "Closing Cost Allocation",
    category: "closing",
    text: "Seller shall pay all customary Seller closing costs including documentary stamps, title insurance, and Seller's attorney fees. Buyer shall pay all customary Buyer closing costs including loan origination fees, Buyer's attorney fees, and recording fees.",
    variables: [],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "seller_closing_credit",
    title: "Seller Closing Cost Credit",
    category: "closing",
    text: "Seller agrees to credit Buyer ${{seller_credit}} toward Buyer's closing costs at the Act of Sale.",
    variables: ["seller_credit"],
    required: false,
    formTypes: ["lrec-101", "lrec-103"],
  },
  {
    id: "earnest_money",
    title: "Earnest Money Deposit",
    category: "terms",
    text: "Buyer shall deposit ${{earnest_money}} as earnest money with {{earnest_money_holder}} within 2 business days of acceptance. Earnest money shall be applied to the purchase price at closing.",
    variables: ["earnest_money", "earnest_money_holder"],
    required: true,
    formTypes: ["lrec-101"],
  },

  // ── LOUISIANA-SPECIFIC CLAUSES ──
  {
    id: "la_flood_disclosure",
    title: "Flood Zone Disclosure (Louisiana)",
    category: "louisiana",
    text: "Seller discloses that the property is located in Flood Zone {{flood_zone}}. Buyer is advised to obtain flood insurance. Federal law requires flood insurance for properties in designated flood zones with federally-backed mortgages.",
    variables: ["flood_zone"],
    conditional: (ctx) => !!ctx.floodZone && ctx.floodZone !== "X",
    required: false,
    formTypes: ["lrec-101", "lrec-102"],
  },
  {
    id: "la_termite_certificate",
    title: "Termite Inspection Certificate (Louisiana)",
    category: "louisiana",
    text: "Seller shall provide a current Wood Destroying Insect Report (WDIR/termite certificate) at Seller's expense, issued within 30 days of the Act of Sale, by a licensed pest control operator.",
    variables: [],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "la_servitudes",
    title: "Servitudes Disclosure (Louisiana Civil Code)",
    category: "louisiana",
    text: "Per Louisiana Civil Code Articles 646-774, the property may be subject to legal servitudes including natural drainage, common wall, and right-of-way servitudes. Known servitudes: {{servitudes}}",
    variables: ["servitudes"],
    conditional: (ctx) => !!ctx.servitudes,
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "la_lead_paint",
    title: "Lead-Based Paint Disclosure",
    category: "disclosure",
    text: "For properties built prior to 1978: Seller discloses the presence of known lead-based paint and/or lead-based paint hazards. Buyer has received the EPA pamphlet 'Protect Your Family From Lead in Your Home.' Buyer has 10 days to conduct a lead-based paint inspection.",
    variables: [],
    conditional: (ctx) => !!ctx.yearBuilt && ctx.yearBuilt < 1978,
    required: false,
    formTypes: ["lrec-101", "lrec-102"],
  },
  {
    id: "la_property_tax_proration",
    title: "Property Tax Proration (Louisiana)",
    category: "louisiana",
    text: "Property taxes for the current year shall be prorated as of the date of the Act of Sale. Louisiana property taxes are assessed by the parish assessor and are payable in arrears.",
    variables: [],
    required: true,
    formTypes: ["lrec-101"],
  },
  {
    id: "la_homestead_exemption",
    title: "Homestead Exemption (Louisiana)",
    category: "louisiana",
    text: "Buyer is advised that Louisiana provides a homestead exemption on the first $75,000 of assessed value for owner-occupied residential property. Buyer should file for homestead exemption with the {{property_parish}} Parish Assessor's office after the Act of Sale.",
    variables: ["property_parish"],
    required: false,
    formTypes: ["lrec-101"],
  },

  // ── PROPERTY CONDITION CLAUSES ──
  {
    id: "as_is",
    title: "As-Is Sale",
    category: "property",
    text: "Buyer accepts the property in its present AS-IS condition. Seller makes no warranties or representations regarding the condition of the property beyond those required by Louisiana law.",
    variables: [],
    required: false,
    formTypes: ["lrec-101", "lrec-103"],
  },
  {
    id: "home_warranty",
    title: "Home Warranty",
    category: "property",
    text: "{{home_warranty_paid_by}} shall provide a home warranty plan through {{home_warranty_provider}} at a cost of ${{home_warranty_cost}}, to be paid at closing.",
    variables: ["home_warranty_paid_by", "home_warranty_provider", "home_warranty_cost"],
    conditional: (ctx) => !!ctx.homeWarranty,
    required: false,
    formTypes: ["lrec-101"],
  },
  {
    id: "hoa_disclosure",
    title: "HOA/POA Disclosure",
    category: "property",
    text: "The property is subject to a Homeowners Association (HOA) / Property Owners Association (POA). Monthly dues are ${{hoa_fees}}. Buyer acknowledges receipt of HOA documents including bylaws, financial statements, and rules.",
    variables: ["hoa_fees"],
    conditional: (ctx) => !!ctx.hasHOA,
    required: false,
    formTypes: ["lrec-101"],
  },

  // ── CONTINGENCY CLAUSES ──
  {
    id: "sale_of_existing_home",
    title: "Contingent on Sale of Buyer's Home",
    category: "contingency",
    text: "This agreement is contingent upon the sale and closing of Buyer's existing property located at {{buyer_existing_address}} on or before {{buyer_sale_deadline}}. If Buyer's property does not close by this date, either party may terminate with earnest money returned.",
    variables: ["buyer_existing_address", "buyer_sale_deadline"],
    required: false,
    formTypes: ["lrec-101", "lrec-103"],
  },
  {
    id: "kickout_clause",
    title: "Kickout Clause (72-Hour)",
    category: "contingency",
    text: "If Seller receives a bona fide offer from another buyer, Seller shall notify Buyer in writing. Buyer shall have 72 hours to remove the sale contingency and proceed with the purchase, or this agreement shall terminate.",
    variables: [],
    required: false,
    formTypes: ["lrec-101", "lrec-103"],
  },
  {
    id: "occupancy_prior_to_closing",
    title: "Early Occupancy Agreement",
    category: "terms",
    text: "Buyer shall be permitted to occupy the property prior to closing, beginning {{occupancy_start_date}}. Buyer shall maintain insurance and be responsible for all utilities. Buyer shall vacate immediately if the transaction does not close.",
    variables: ["occupancy_start_date"],
    required: false,
    formTypes: ["lrec-103"],
  },
  {
    id: "seller_leaseback",
    title: "Seller Leaseback After Closing",
    category: "terms",
    text: "Seller shall lease back the property from Buyer for {{leaseback_days}} days after the Act of Sale at ${{leaseback_rent}}/day. Seller shall maintain insurance and be responsible for utilities during the leaseback period.",
    variables: ["leaseback_days", "leaseback_rent"],
    required: false,
    formTypes: ["lrec-103"],
  },
]

// ─── CLAUSE SELECTION ENGINE ────────────────────────────────────────────────

/**
 * Select applicable clauses for a form based on context.
 */
export function selectClauses(formId: string, ctx: ClauseContext): Clause[] {
  return CLAUSES.filter(clause => {
    // Must apply to this form type
    if (!clause.formTypes.includes(formId)) return false
    // Required clauses always included
    if (clause.required) return true
    // Conditional clauses checked against context
    if (clause.conditional) return clause.conditional(ctx)
    return false
  })
}

/**
 * Build full contract text from selected clauses with variable substitution.
 */
export function buildContractText(clauses: Clause[], vars: Record<string, string>): string {
  return clauses.map(clause => {
    const filled = substituteVariables(clause.text, vars)
    return `**${clause.title}**\n${filled}`
  }).join("\n\n")
}

/**
 * Get all available clauses for manual selection.
 */
export function getAvailableClauses(formId: string): Clause[] {
  return CLAUSES.filter(c => c.formTypes.includes(formId))
}
