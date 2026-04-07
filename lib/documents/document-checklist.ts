/**
 * AIRE Document Checklist — Required documents by deal stage
 * Used in the transaction detail Documents tab to show what's missing.
 */

export interface ChecklistItem {
  type: string
  label: string
  required: boolean | string // true, false, or conditional like "if built before 1978"
}

export const REQUIRED_DOCUMENTS: Record<string, ChecklistItem[]> = {
  UNDER_CONTRACT: [
    { type: "purchase_agreement", label: "Purchase Agreement (LREC-101)", required: true },
    { type: "property_disclosure", label: "Property Disclosure (LREC-102)", required: true },
    { type: "earnest_money_receipt", label: "Earnest Money Receipt", required: true },
    { type: "lead_paint_disclosure", label: "Lead Paint Disclosure", required: "if built before 1978" },
    { type: "agency_disclosure", label: "Agency Disclosure", required: true },
  ],
  PENDING_INSPECTION: [
    { type: "inspection_report", label: "Home Inspection Report", required: true },
    { type: "termite_certificate", label: "Termite/WDI Certificate", required: true },
    { type: "repair_request", label: "Repair Request", required: false },
    { type: "repair_response", label: "Seller Repair Response", required: false },
  ],
  PENDING_APPRAISAL: [
    { type: "appraisal_report", label: "Appraisal Report", required: true },
    { type: "appraisal_addendum", label: "Appraisal Contingency Addendum", required: false },
  ],
  PENDING_FINANCING: [
    { type: "loan_approval", label: "Loan Approval Letter", required: true },
    { type: "closing_disclosure", label: "Closing Disclosure (CD)", required: true },
  ],
  CLOSING: [
    { type: "title_commitment", label: "Title Commitment", required: true },
    { type: "survey", label: "Survey", required: false },
    { type: "hoa_docs", label: "HOA Documents", required: false },
    { type: "final_walkthrough", label: "Final Walk-Through Confirmation", required: true },
  ],
}

// Status progression order
const STAGE_ORDER = ["UNDER_CONTRACT", "PENDING_INSPECTION", "PENDING_APPRAISAL", "PENDING_FINANCING", "CLOSING"]

/**
 * Get all required documents for a deal up to its current stage.
 * E.g. if in PENDING_APPRAISAL, includes UNDER_CONTRACT + PENDING_INSPECTION + PENDING_APPRAISAL docs.
 */
export function getChecklistForStage(status: string): { stage: string; label: string; items: ChecklistItem[] }[] {
  const currentIdx = STAGE_ORDER.indexOf(status)
  if (currentIdx === -1) {
    // For ACTIVE/DRAFT, show UNDER_CONTRACT requirements
    return [{ stage: "UNDER_CONTRACT", label: "Under Contract", items: REQUIRED_DOCUMENTS.UNDER_CONTRACT }]
  }

  const stageLabels: Record<string, string> = {
    UNDER_CONTRACT: "Under Contract",
    PENDING_INSPECTION: "Inspection",
    PENDING_APPRAISAL: "Appraisal",
    PENDING_FINANCING: "Financing",
    CLOSING: "Closing",
  }

  return STAGE_ORDER.slice(0, currentIdx + 1).map(stage => ({
    stage,
    label: stageLabels[stage] || stage,
    items: REQUIRED_DOCUMENTS[stage],
  }))
}

/**
 * Match uploaded documents against the checklist.
 * Returns each checklist item with its upload status.
 */
export function matchDocumentsToChecklist(
  checklist: ChecklistItem[],
  uploadedDocs: { type: string; name: string; checklistStatus: string | null; createdAt: string }[]
): (ChecklistItem & { uploaded: boolean; uploadedDoc?: typeof uploadedDocs[0] })[] {
  return checklist.map(item => {
    const match = uploadedDocs.find(d => d.type === item.type)
    return {
      ...item,
      uploaded: !!match,
      uploadedDoc: match,
    }
  })
}
