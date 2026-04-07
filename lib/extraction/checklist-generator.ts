/**
 * AIRE Document Checklist Generator
 *
 * Generates the required document list for a Louisiana RE transaction
 * based on property type, transaction status, and deal specifics.
 */

export interface ChecklistItem {
  type: string;
  label: string;
  category: "mandatory" | "addendum" | "federal" | "additional";
  required: boolean;
  description: string;
  lrecFormNumber?: string;
}

export interface ChecklistStatus {
  item: ChecklistItem;
  status: "missing" | "uploaded" | "extracted" | "verified";
  documentId?: string;
  confidence?: number;
}

// Base required documents for ALL Louisiana residential transactions
const BASE_CHECKLIST: ChecklistItem[] = [
  {
    type: "purchase_agreement",
    label: "Purchase Agreement",
    category: "mandatory",
    required: true,
    description: "Louisiana Residential Agreement to Buy or Sell",
    lrecFormNumber: "LREC-001",
  },
  {
    type: "property_disclosure",
    label: "Property Disclosure",
    category: "mandatory",
    required: true,
    description: "Seller's Property Condition Disclosure Document",
    lrecFormNumber: "LREC-002",
  },
  {
    type: "agency_disclosure",
    label: "Agency Disclosure",
    category: "mandatory",
    required: true,
    description: "Agency Disclosure Form for Buyers and Sellers",
    lrecFormNumber: "LREC-003",
  },
  {
    type: "lead_paint",
    label: "Lead-Based Paint Disclosure",
    category: "federal",
    required: true, // required for homes built before 1978
    description: "Federal Lead-Based Paint Disclosure (pre-1978 homes)",
  },
];

// Conditional documents based on transaction specifics
const CONDITIONAL_ITEMS: Array<ChecklistItem & { condition: string }> = [
  {
    type: "inspection_response",
    label: "Inspection Response",
    category: "addendum",
    required: false,
    description: "Buyer inspection findings and repair requests",
    condition: "post_inspection",
  },
  {
    type: "condominium_addendum",
    label: "Condominium Addendum",
    category: "addendum",
    required: false,
    description: "Required for condominium purchases",
    condition: "condo",
  },
  {
    type: "deposit_addendum",
    label: "Earnest Money Addendum",
    category: "addendum",
    required: false,
    description: "Modified earnest money deposit terms",
    condition: "modified_deposit",
  },
  {
    type: "new_construction_addendum",
    label: "New Construction Addendum",
    category: "addendum",
    required: false,
    description: "Required for new construction purchases",
    condition: "new_construction",
  },
  {
    type: "vacant_land",
    label: "Vacant Land Agreement",
    category: "additional",
    required: false,
    description: "Purchase agreement for unimproved land",
    condition: "vacant_land",
  },
  {
    type: "home_warranty",
    label: "Home Warranty Disclosure",
    category: "additional",
    required: false,
    description: "Home warranty information and terms",
    condition: "has_warranty",
  },
];

interface ChecklistOptions {
  propertyType?: string; // "residential", "condo", "land", "new_construction"
  transactionStatus?: string;
  includeOptional?: boolean;
}

/**
 * Generate the required document checklist for a transaction.
 */
export function generateChecklist(options: ChecklistOptions = {}): ChecklistItem[] {
  const { propertyType, transactionStatus, includeOptional = false } = options;

  const checklist = [...BASE_CHECKLIST];

  // Add conditional items based on property type
  if (propertyType === "condo" || propertyType === "condominium") {
    const condo = CONDITIONAL_ITEMS.find((i) => i.condition === "condo");
    if (condo) checklist.push({ ...condo, required: true });
  }

  if (propertyType === "land" || propertyType === "vacant_land") {
    const land = CONDITIONAL_ITEMS.find((i) => i.condition === "vacant_land");
    if (land) checklist.push({ ...land, required: true });
  }

  if (propertyType === "new_construction") {
    const nc = CONDITIONAL_ITEMS.find((i) => i.condition === "new_construction");
    if (nc) checklist.push({ ...nc, required: true });
  }

  // Add inspection response if past inspection phase
  if (
    transactionStatus &&
    ["PENDING_APPRAISAL", "PENDING_FINANCING", "CLOSING", "CLOSED"].includes(transactionStatus)
  ) {
    const inspection = CONDITIONAL_ITEMS.find((i) => i.condition === "post_inspection");
    if (inspection) checklist.push(inspection);
  }

  // Add optional items if requested
  if (includeOptional) {
    for (const item of CONDITIONAL_ITEMS) {
      if (!checklist.some((c) => c.type === item.type)) {
        checklist.push(item);
      }
    }
  }

  return checklist;
}

/**
 * Check a transaction's documents against the required checklist.
 */
export function evaluateChecklist(
  checklist: ChecklistItem[],
  documents: Array<{ type: string; id: string; checklistStatus: string | null; classification: unknown }>
): ChecklistStatus[] {
  return checklist.map((item) => {
    const match = documents.find((d) => d.type === item.type);
    if (!match) {
      return { item, status: "missing" as const };
    }

    const classification = match.classification as { confidence?: number } | null;
    return {
      item,
      status: (match.checklistStatus || "uploaded") as ChecklistStatus["status"],
      documentId: match.id,
      confidence: classification?.confidence,
    };
  });
}
