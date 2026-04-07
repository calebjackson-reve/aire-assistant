/**
 * AIRE Contract Writing Engine — LREC Form Field Mappings
 * Phase 1: Complete field definitions for Louisiana LREC forms.
 *
 * Forms mapped:
 *   LREC-101: Residential Agreement to Buy or Sell (Purchase Agreement)
 *   LREC-102: Property Disclosure Document
 *   LREC-103: Addendum / Amendment to Agreement
 *
 * Each field has: id, label, section, type, required flag, and PDF coordinates.
 * Coordinates are percentage-based (0-100) for resolution independence.
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type FieldDataType = "text" | "date" | "currency" | "number" | "boolean" | "address" | "phone" | "email" | "parish" | "signature"

export interface FormField {
  id: string
  label: string
  section: string
  type: FieldDataType
  required: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  maxLength?: number
  defaultValue?: string
  helpText?: string
  louisianaSpecific?: boolean // True for fields unique to LA law
}

export interface FormDefinition {
  formId: string
  formNumber: string
  title: string
  revision: string
  pages: number
  fields: FormField[]
  requiredParties: string[]
  description: string
}

// ─── LREC-101: PURCHASE AGREEMENT ───────────────────────────────────────────

export const LREC_101: FormDefinition = {
  formId: "lrec-101",
  formNumber: "LREC-101",
  title: "Louisiana Residential Agreement to Buy or Sell",
  revision: "Rev 2024",
  pages: 4,
  requiredParties: ["buyer", "seller"],
  description: "Standard purchase agreement for residential real estate in Louisiana",
  fields: [
    // ── Page 1: Property & Parties ──
    { id: "property_address", label: "Property Address", section: "property", type: "address", required: true, page: 1, xPercent: 12, yPercent: 12, widthPercent: 55, heightPercent: 3 },
    { id: "property_city", label: "City", section: "property", type: "text", required: true, page: 1, xPercent: 12, yPercent: 16, widthPercent: 25, heightPercent: 3, defaultValue: "Baton Rouge" },
    { id: "property_parish", label: "Parish", section: "property", type: "parish", required: true, page: 1, xPercent: 40, yPercent: 16, widthPercent: 25, heightPercent: 3, defaultValue: "East Baton Rouge", louisianaSpecific: true },
    { id: "property_zip", label: "Zip Code", section: "property", type: "text", required: false, page: 1, xPercent: 68, yPercent: 16, widthPercent: 12, heightPercent: 3 },
    { id: "legal_description", label: "Legal Description (Lot/Block/Subdivision)", section: "property", type: "text", required: false, page: 1, xPercent: 12, yPercent: 20, widthPercent: 76, heightPercent: 4, louisianaSpecific: true, helpText: "Lot, Block, and Subdivision per parish records" },
    { id: "property_type", label: "Property Type", section: "property", type: "text", required: false, page: 1, xPercent: 12, yPercent: 25, widthPercent: 25, heightPercent: 3, defaultValue: "Residential" },
    { id: "mls_number", label: "MLS #", section: "property", type: "text", required: false, page: 1, xPercent: 40, yPercent: 25, widthPercent: 20, heightPercent: 3 },

    // Parties
    { id: "buyer_name", label: "Buyer Name(s)", section: "parties", type: "text", required: true, page: 1, xPercent: 12, yPercent: 32, widthPercent: 55, heightPercent: 3 },
    { id: "buyer_address", label: "Buyer Address", section: "parties", type: "address", required: false, page: 1, xPercent: 12, yPercent: 36, widthPercent: 55, heightPercent: 3 },
    { id: "buyer_phone", label: "Buyer Phone", section: "parties", type: "phone", required: false, page: 1, xPercent: 12, yPercent: 40, widthPercent: 25, heightPercent: 3 },
    { id: "buyer_email", label: "Buyer Email", section: "parties", type: "email", required: false, page: 1, xPercent: 40, yPercent: 40, widthPercent: 30, heightPercent: 3 },

    { id: "seller_name", label: "Seller Name(s)", section: "parties", type: "text", required: true, page: 1, xPercent: 12, yPercent: 46, widthPercent: 55, heightPercent: 3 },
    { id: "seller_address", label: "Seller Address", section: "parties", type: "address", required: false, page: 1, xPercent: 12, yPercent: 50, widthPercent: 55, heightPercent: 3 },
    { id: "seller_phone", label: "Seller Phone", section: "parties", type: "phone", required: false, page: 1, xPercent: 12, yPercent: 54, widthPercent: 25, heightPercent: 3 },

    // ── Page 1-2: Price & Terms ──
    { id: "purchase_price", label: "Purchase Price", section: "price", type: "currency", required: true, page: 1, xPercent: 12, yPercent: 62, widthPercent: 25, heightPercent: 3 },
    { id: "earnest_money", label: "Earnest Money Deposit", section: "price", type: "currency", required: true, page: 1, xPercent: 40, yPercent: 62, widthPercent: 25, heightPercent: 3 },
    { id: "earnest_money_holder", label: "Earnest Money Held By", section: "price", type: "text", required: false, page: 1, xPercent: 12, yPercent: 66, widthPercent: 40, heightPercent: 3 },
    { id: "financing_type", label: "Financing Type", section: "price", type: "text", required: false, page: 1, xPercent: 12, yPercent: 70, widthPercent: 25, heightPercent: 3, helpText: "Conventional, FHA, VA, USDA, Cash" },
    { id: "loan_amount", label: "Loan Amount", section: "price", type: "currency", required: false, page: 1, xPercent: 40, yPercent: 70, widthPercent: 25, heightPercent: 3 },
    { id: "down_payment", label: "Down Payment", section: "price", type: "currency", required: false, page: 1, xPercent: 68, yPercent: 70, widthPercent: 20, heightPercent: 3 },

    // ── Page 2: Dates & Deadlines ──
    { id: "contract_date", label: "Contract Date", section: "dates", type: "date", required: true, page: 2, xPercent: 12, yPercent: 10, widthPercent: 20, heightPercent: 3 },
    { id: "acceptance_deadline", label: "Offer Acceptance Deadline", section: "dates", type: "date", required: false, page: 2, xPercent: 35, yPercent: 10, widthPercent: 20, heightPercent: 3 },

    { id: "inspection_days", label: "Inspection Period (days)", section: "dates", type: "number", required: true, page: 2, xPercent: 12, yPercent: 18, widthPercent: 15, heightPercent: 3, defaultValue: "14" },
    { id: "appraisal_days", label: "Appraisal Period (days)", section: "dates", type: "number", required: true, page: 2, xPercent: 30, yPercent: 18, widthPercent: 15, heightPercent: 3, defaultValue: "14" },
    { id: "financing_days", label: "Financing Period (days)", section: "dates", type: "number", required: true, page: 2, xPercent: 48, yPercent: 18, widthPercent: 15, heightPercent: 3, defaultValue: "25" },

    { id: "closing_date", label: "Closing Date (Act of Sale)", section: "dates", type: "date", required: true, page: 2, xPercent: 12, yPercent: 26, widthPercent: 20, heightPercent: 3, louisianaSpecific: true, helpText: "Date of Act of Sale" },
    { id: "possession_date", label: "Possession Date", section: "dates", type: "date", required: false, page: 2, xPercent: 35, yPercent: 26, widthPercent: 20, heightPercent: 3 },

    // ── Page 2: Louisiana-Specific Terms ──
    { id: "act_of_sale_location", label: "Act of Sale Location", section: "la_terms", type: "text", required: false, page: 2, xPercent: 12, yPercent: 34, widthPercent: 50, heightPercent: 3, louisianaSpecific: true, helpText: "Title company or attorney office" },
    { id: "title_company", label: "Title Company", section: "la_terms", type: "text", required: false, page: 2, xPercent: 12, yPercent: 38, widthPercent: 40, heightPercent: 3 },
    { id: "title_insurance_paid_by", label: "Title Insurance Paid By", section: "la_terms", type: "text", required: false, page: 2, xPercent: 55, yPercent: 38, widthPercent: 20, heightPercent: 3, defaultValue: "Seller", louisianaSpecific: true },
    { id: "survey_required", label: "Survey Required", section: "la_terms", type: "boolean", required: false, page: 2, xPercent: 12, yPercent: 42, widthPercent: 5, heightPercent: 3, louisianaSpecific: true },
    { id: "termite_inspection", label: "Termite Inspection Required", section: "la_terms", type: "boolean", required: false, page: 2, xPercent: 35, yPercent: 42, widthPercent: 5, heightPercent: 3, defaultValue: "true", louisianaSpecific: true },
    { id: "flood_zone", label: "Flood Zone", section: "la_terms", type: "text", required: false, page: 2, xPercent: 12, yPercent: 46, widthPercent: 15, heightPercent: 3, louisianaSpecific: true },
    { id: "servitudes", label: "Known Servitudes", section: "la_terms", type: "text", required: false, page: 2, xPercent: 30, yPercent: 46, widthPercent: 50, heightPercent: 3, louisianaSpecific: true, helpText: "Easements/servitudes per Louisiana Civil Code" },

    // ── Page 3: Conditions & Contingencies ──
    { id: "home_warranty", label: "Home Warranty", section: "conditions", type: "boolean", required: false, page: 3, xPercent: 12, yPercent: 10, widthPercent: 5, heightPercent: 3 },
    { id: "home_warranty_provider", label: "Warranty Provider", section: "conditions", type: "text", required: false, page: 3, xPercent: 20, yPercent: 10, widthPercent: 30, heightPercent: 3 },
    { id: "home_warranty_cost", label: "Warranty Cost", section: "conditions", type: "currency", required: false, page: 3, xPercent: 53, yPercent: 10, widthPercent: 15, heightPercent: 3 },
    { id: "home_warranty_paid_by", label: "Warranty Paid By", section: "conditions", type: "text", required: false, page: 3, xPercent: 70, yPercent: 10, widthPercent: 15, heightPercent: 3 },

    { id: "appliances_included", label: "Appliances Included", section: "conditions", type: "text", required: false, page: 3, xPercent: 12, yPercent: 18, widthPercent: 76, heightPercent: 4, helpText: "Refrigerator, washer, dryer, etc." },
    { id: "personal_property", label: "Personal Property Included", section: "conditions", type: "text", required: false, page: 3, xPercent: 12, yPercent: 24, widthPercent: 76, heightPercent: 4 },
    { id: "exclusions", label: "Exclusions", section: "conditions", type: "text", required: false, page: 3, xPercent: 12, yPercent: 30, widthPercent: 76, heightPercent: 4 },

    { id: "special_conditions", label: "Special Conditions", section: "conditions", type: "text", required: false, page: 3, xPercent: 12, yPercent: 38, widthPercent: 76, heightPercent: 15, helpText: "Additional terms, clauses, or conditions" },

    // ── Page 4: Agent Info & Signatures ──
    { id: "listing_agent_name", label: "Listing Agent", section: "agents", type: "text", required: false, page: 4, xPercent: 12, yPercent: 10, widthPercent: 35, heightPercent: 3 },
    { id: "listing_agent_license", label: "License #", section: "agents", type: "text", required: false, page: 4, xPercent: 50, yPercent: 10, widthPercent: 20, heightPercent: 3 },
    { id: "listing_brokerage", label: "Listing Brokerage", section: "agents", type: "text", required: false, page: 4, xPercent: 12, yPercent: 14, widthPercent: 35, heightPercent: 3 },

    { id: "selling_agent_name", label: "Selling Agent", section: "agents", type: "text", required: false, page: 4, xPercent: 12, yPercent: 22, widthPercent: 35, heightPercent: 3 },
    { id: "selling_agent_license", label: "License #", section: "agents", type: "text", required: false, page: 4, xPercent: 50, yPercent: 22, widthPercent: 20, heightPercent: 3 },
    { id: "selling_brokerage", label: "Selling Brokerage", section: "agents", type: "text", required: false, page: 4, xPercent: 12, yPercent: 26, widthPercent: 35, heightPercent: 3 },

    // Signatures
    { id: "buyer_signature", label: "Buyer Signature", section: "signatures", type: "signature", required: true, page: 4, xPercent: 12, yPercent: 70, widthPercent: 30, heightPercent: 4 },
    { id: "buyer_signature_date", label: "Date", section: "signatures", type: "date", required: true, page: 4, xPercent: 45, yPercent: 70, widthPercent: 15, heightPercent: 4 },
    { id: "seller_signature", label: "Seller Signature", section: "signatures", type: "signature", required: true, page: 4, xPercent: 12, yPercent: 80, widthPercent: 30, heightPercent: 4 },
    { id: "seller_signature_date", label: "Date", section: "signatures", type: "date", required: true, page: 4, xPercent: 45, yPercent: 80, widthPercent: 15, heightPercent: 4 },
  ],
}

// ─── LREC-102: PROPERTY DISCLOSURE ──────────────────────────────────────────

export const LREC_102: FormDefinition = {
  formId: "lrec-102",
  formNumber: "LREC-102",
  title: "Louisiana Property Disclosure Document",
  revision: "Rev 2024",
  pages: 3,
  requiredParties: ["seller"],
  description: "Seller disclosure of known property conditions per Louisiana law",
  fields: [
    { id: "property_address", label: "Property Address", section: "property", type: "address", required: true, page: 1, xPercent: 12, yPercent: 12, widthPercent: 60, heightPercent: 3 },
    { id: "seller_name", label: "Seller Name(s)", section: "property", type: "text", required: true, page: 1, xPercent: 12, yPercent: 18, widthPercent: 50, heightPercent: 3 },
    { id: "year_built", label: "Year Built", section: "structure", type: "number", required: false, page: 1, xPercent: 12, yPercent: 26, widthPercent: 12, heightPercent: 3 },
    { id: "square_footage", label: "Square Footage", section: "structure", type: "number", required: false, page: 1, xPercent: 27, yPercent: 26, widthPercent: 15, heightPercent: 3 },

    // Disclosure checkboxes
    { id: "foundation_issues", label: "Foundation Issues", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 34, widthPercent: 5, heightPercent: 3 },
    { id: "roof_issues", label: "Roof Issues", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 38, widthPercent: 5, heightPercent: 3 },
    { id: "plumbing_issues", label: "Plumbing Issues", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 42, widthPercent: 5, heightPercent: 3 },
    { id: "electrical_issues", label: "Electrical Issues", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 46, widthPercent: 5, heightPercent: 3 },
    { id: "hvac_issues", label: "HVAC Issues", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 50, widthPercent: 5, heightPercent: 3 },
    { id: "termite_damage", label: "Termite/Pest Damage", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 54, widthPercent: 5, heightPercent: 3, louisianaSpecific: true },
    { id: "flood_history", label: "Flood History", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 58, widthPercent: 5, heightPercent: 3, louisianaSpecific: true },
    { id: "mold_issues", label: "Mold/Mildew", section: "disclosures", type: "boolean", required: true, page: 1, xPercent: 12, yPercent: 62, widthPercent: 5, heightPercent: 3 },
    { id: "lead_paint", label: "Lead-Based Paint (pre-1978)", section: "disclosures", type: "boolean", required: true, page: 2, xPercent: 12, yPercent: 10, widthPercent: 5, heightPercent: 3 },
    { id: "asbestos", label: "Asbestos", section: "disclosures", type: "boolean", required: true, page: 2, xPercent: 12, yPercent: 14, widthPercent: 5, heightPercent: 3 },
    { id: "environmental_hazards", label: "Environmental Hazards", section: "disclosures", type: "boolean", required: true, page: 2, xPercent: 12, yPercent: 18, widthPercent: 5, heightPercent: 3 },
    { id: "hoa", label: "HOA/POA", section: "disclosures", type: "boolean", required: true, page: 2, xPercent: 12, yPercent: 22, widthPercent: 5, heightPercent: 3 },
    { id: "hoa_fees", label: "HOA Monthly Fees", section: "disclosures", type: "currency", required: false, page: 2, xPercent: 25, yPercent: 22, widthPercent: 15, heightPercent: 3 },
    { id: "servitudes_disclosure", label: "Known Servitudes/Easements", section: "disclosures", type: "text", required: false, page: 2, xPercent: 12, yPercent: 28, widthPercent: 76, heightPercent: 4, louisianaSpecific: true },
    { id: "additional_disclosures", label: "Additional Disclosures", section: "disclosures", type: "text", required: false, page: 2, xPercent: 12, yPercent: 36, widthPercent: 76, heightPercent: 20 },

    // Signatures
    { id: "seller_signature", label: "Seller Signature", section: "signatures", type: "signature", required: true, page: 3, xPercent: 12, yPercent: 70, widthPercent: 30, heightPercent: 4 },
    { id: "seller_signature_date", label: "Date", section: "signatures", type: "date", required: true, page: 3, xPercent: 45, yPercent: 70, widthPercent: 15, heightPercent: 4 },
    { id: "buyer_acknowledgment", label: "Buyer Acknowledgment", section: "signatures", type: "signature", required: false, page: 3, xPercent: 12, yPercent: 82, widthPercent: 30, heightPercent: 4 },
  ],
}

// ─── LREC-103: ADDENDUM / AMENDMENT ─────────────────────────────────────────

export const LREC_103: FormDefinition = {
  formId: "lrec-103",
  formNumber: "LREC-103",
  title: "Addendum / Amendment to Residential Agreement",
  revision: "Rev 2024",
  pages: 2,
  requiredParties: ["buyer", "seller"],
  description: "Addendum or amendment modifying the original purchase agreement",
  fields: [
    // Reference to original agreement
    { id: "property_address", label: "Property Address", section: "reference", type: "address", required: true, page: 1, xPercent: 12, yPercent: 14, widthPercent: 60, heightPercent: 3 },
    { id: "buyer_name", label: "Buyer", section: "reference", type: "text", required: true, page: 1, xPercent: 12, yPercent: 20, widthPercent: 35, heightPercent: 3 },
    { id: "seller_name", label: "Seller", section: "reference", type: "text", required: true, page: 1, xPercent: 50, yPercent: 20, widthPercent: 35, heightPercent: 3 },
    { id: "original_contract_date", label: "Original Contract Date", section: "reference", type: "date", required: true, page: 1, xPercent: 12, yPercent: 26, widthPercent: 20, heightPercent: 3 },
    { id: "addendum_number", label: "Addendum #", section: "reference", type: "number", required: false, page: 1, xPercent: 35, yPercent: 26, widthPercent: 10, heightPercent: 3 },

    // Addendum content
    { id: "addendum_type", label: "Type of Modification", section: "content", type: "text", required: true, page: 1, xPercent: 12, yPercent: 34, widthPercent: 60, heightPercent: 3 },
    { id: "addendum_text", label: "Terms and Conditions", section: "content", type: "text", required: true, page: 1, xPercent: 12, yPercent: 40, widthPercent: 76, heightPercent: 45, helpText: "Full text of the addendum modification" },

    // Signatures
    { id: "buyer_signature", label: "Buyer Signature", section: "signatures", type: "signature", required: true, page: 2, xPercent: 12, yPercent: 60, widthPercent: 30, heightPercent: 4 },
    { id: "buyer_signature_date", label: "Date", section: "signatures", type: "date", required: true, page: 2, xPercent: 45, yPercent: 60, widthPercent: 15, heightPercent: 4 },
    { id: "seller_signature", label: "Seller Signature", section: "signatures", type: "signature", required: true, page: 2, xPercent: 12, yPercent: 72, widthPercent: 30, heightPercent: 4 },
    { id: "seller_signature_date", label: "Date", section: "signatures", type: "date", required: true, page: 2, xPercent: 45, yPercent: 72, widthPercent: 15, heightPercent: 4 },
  ],
}

// ─── FORM REGISTRY ──────────────────────────────────────────────────────────

export const FORM_REGISTRY: Record<string, FormDefinition> = {
  "lrec-101": LREC_101,
  "lrec-102": LREC_102,
  "lrec-103": LREC_103,
  "purchase_agreement": LREC_101,
  "property_disclosure": LREC_102,
  "addendum": LREC_103,
}

export function getFormDefinition(formId: string): FormDefinition | null {
  return FORM_REGISTRY[formId.toLowerCase()] || null
}

export function getRequiredFields(formId: string): FormField[] {
  const form = getFormDefinition(formId)
  if (!form) return []
  return form.fields.filter(f => f.required)
}

export function getLouisianaSpecificFields(formId: string): FormField[] {
  const form = getFormDefinition(formId)
  if (!form) return []
  return form.fields.filter(f => f.louisianaSpecific)
}

// ─── LOUISIANA PARISHES ─────────────────────────────────────────────────────

export const LOUISIANA_PARISHES = [
  "Acadia", "Allen", "Ascension", "Assumption", "Avoyelles",
  "Beauregard", "Bienville", "Bossier", "Caddo", "Calcasieu",
  "Caldwell", "Cameron", "Catahoula", "Claiborne", "Concordia",
  "De Soto", "East Baton Rouge", "East Carroll", "East Feliciana",
  "Evangeline", "Franklin", "Grant", "Iberia", "Iberville",
  "Jackson", "Jefferson", "Jefferson Davis", "La Salle", "Lafayette",
  "Lafourche", "Lincoln", "Livingston", "Madison", "Morehouse",
  "Natchitoches", "Orleans", "Ouachita", "Plaquemines", "Pointe Coupee",
  "Rapides", "Red River", "Richland", "Sabine", "St. Bernard",
  "St. Charles", "St. Helena", "St. James", "St. John the Baptist",
  "St. Landry", "St. Martin", "St. Mary", "St. Tammany",
  "Tangipahoa", "Tensas", "Terrebonne", "Union", "Vermilion",
  "Vernon", "Washington", "Webster", "West Baton Rouge",
  "West Carroll", "West Feliciana", "Winn",
]
