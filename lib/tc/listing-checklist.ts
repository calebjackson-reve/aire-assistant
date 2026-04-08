/**
 * Pre-Listing Document Checklist — Reve Realtors / GBRAR / LREC
 *
 * Mirrors the exact document set from Dotloop that the brokerage requires
 * before a property can be listed on MLS.
 */

export type ChecklistItemStatus = "missing" | "uploaded" | "sent" | "signed" | "approved"
export type ChecklistRequirement = "required" | "optional" | "conditional"

export interface ChecklistItem {
  id: string
  name: string
  shortName: string
  requirement: ChecklistRequirement
  condition?: string // e.g., "Pre-1978 property"
  description: string
  signers: ("seller" | "agent" | "buyer")[]
  lrecFormNumber?: string
  category: "listing" | "disclosure" | "brokerage" | "mls"
}

/**
 * The master checklist — ordered by the flow an agent would use.
 * Matches Caleb's Dotloop folder "LISTING DOCUMENTS" exactly.
 */
export const LISTING_CHECKLIST: ChecklistItem[] = [
  {
    id: "listing-agreement",
    name: "Listing & Marketing Agreement",
    shortName: "0815 Listing Agreement",
    requirement: "required",
    description: "The exclusive right to sell agreement between agent and seller. Sets commission, listing period, and marketing terms.",
    signers: ["seller", "agent"],
    lrecFormNumber: "0815",
    category: "listing",
  },
  {
    id: "agency-disclosure",
    name: "Agency Disclosure Form",
    shortName: "Reve Agency Disclosure Form",
    requirement: "required",
    description: "Discloses agency relationship between agent and all parties. Louisiana LREC requirement.",
    signers: ["seller", "agent"],
    category: "brokerage",
  },
  {
    id: "property-disclosure",
    name: "2026 Property Disclosure (LREC)",
    shortName: "Property Disclosure",
    requirement: "required",
    description: "Seller's written disclosure of all known material defects in the property. Louisiana R.S. 9:3198.",
    signers: ["seller"],
    lrecFormNumber: "2026",
    category: "disclosure",
  },
  {
    id: "wood-destroying-insect",
    name: "GBRAR Wood Destroying Insect Addendum",
    shortName: "WDI Addendum",
    requirement: "required",
    description: "Addendum regarding wood destroying insect inspection. GBRAR MLS requirement for all residential listings.",
    signers: ["seller", "agent"],
    category: "listing",
  },
  {
    id: "dual-agency-disclosure",
    name: "Dual Agency Disclosure",
    shortName: "Reve Dual Agency Disclosure",
    requirement: "optional",
    description: "Required if agent or brokerage may represent both buyer and seller in the transaction.",
    signers: ["seller", "agent"],
    category: "brokerage",
  },
  {
    id: "listing-exclusion",
    name: "Listing Exclusion Agreement",
    shortName: "Listing Exclusion Agreement",
    requirement: "optional",
    description: "Lists any parties excluded from the listing agreement (e.g., a buyer the seller is already negotiating with).",
    signers: ["seller", "agent"],
    category: "listing",
  },
  {
    id: "waiver-of-warranty",
    name: "Waiver of Warranty",
    shortName: "Reve Waiver of Warranty",
    requirement: "optional",
    description: "Seller waives home warranty coverage. Used when property is sold as-is or seller declines to provide warranty.",
    signers: ["seller"],
    category: "brokerage",
  },
  {
    id: "lead-based-paint",
    name: "Lead-Based Paint Disclosure (LREC)",
    shortName: "Lead-Based Paint",
    requirement: "conditional",
    condition: "Property built before 1978",
    description: "Federal requirement for properties built before 1978. Discloses known lead-based paint hazards.",
    signers: ["seller", "agent"],
    category: "disclosure",
  },
  {
    id: "mls-sheet",
    name: "MLS Sheet (Agent Full w/ Photo)",
    shortName: "MLS Sheet",
    requirement: "optional",
    description: "Agent's MLS input sheet with property details, photos, and listing information for GBRAR MLS.",
    signers: [],
    category: "mls",
  },
]

/**
 * Get the required checklist for a listing based on property details.
 */
export function getListingChecklist(options?: {
  yearBuilt?: number
  includeOptional?: boolean
}): ChecklistItem[] {
  return LISTING_CHECKLIST.filter((item) => {
    // Always include required items
    if (item.requirement === "required") return true

    // Include conditional items based on conditions
    if (item.requirement === "conditional") {
      if (item.id === "lead-based-paint" && options?.yearBuilt && options.yearBuilt < 1978) {
        return true
      }
      return false
    }

    // Include optional items if requested
    if (item.requirement === "optional" && options?.includeOptional) return true

    return false
  })
}

/**
 * Determine what fields we can auto-fill from transaction + user data.
 */
export function getAutoFillFields(transaction: {
  propertyAddress: string
  propertyCity: string
  propertyState: string
  propertyZip?: string | null
  listPrice?: number | null
  sellerName?: string | null
  sellerEmail?: string | null
}, agent: {
  firstName?: string | null
  lastName?: string | null
  email: string
  licenseNumber?: string | null
  brokerageName?: string | null
}) {
  return {
    propertyAddress: transaction.propertyAddress,
    propertyCity: transaction.propertyCity,
    propertyState: transaction.propertyState,
    propertyZip: transaction.propertyZip || "",
    listPrice: transaction.listPrice?.toString() || "",
    sellerName: transaction.sellerName || "",
    sellerEmail: transaction.sellerEmail || "",
    agentName: [agent.firstName, agent.lastName].filter(Boolean).join(" "),
    agentEmail: agent.email,
    agentLicense: agent.licenseNumber || "",
    brokerageName: agent.brokerageName || "Reve Realtors",
    listingDate: new Date().toLocaleDateString("en-US"),
  }
}
