// lib/airsign/form-templates.ts
// Pre-computed field placement maps for common LREC forms.
// When a PDF is uploaded and classified, the matching template is auto-applied
// so the agent doesn't have to manually place every signature block.
//
// Coordinates are percentages (xPercent, yPercent, widthPercent, heightPercent)
// relative to the top-left of each page. Sourced from
// AGENT_MISSIONS/research/lrec-form-field-maps.md.

export type TemplateFieldType = "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"

/**
 * Signer role that a template field should be assigned to.
 * Concrete mapping to AirSignSigner IDs happens at application time based on the
 * envelope's signers (matched by role name, then by order).
 */
export type TemplateSignerRole =
  | "buyer"
  | "buyer_spouse"
  | "seller"
  | "seller_spouse"
  | "buyer_agent"
  | "seller_agent"
  | "all_signers"

export interface TemplateField {
  type: TemplateFieldType
  label?: string
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  required?: boolean
  assignTo: TemplateSignerRole
}

/**
 * LREC-101 — Louisiana Residential Agreement to Buy or Sell
 * Source: AGENT_MISSIONS/research/lrec-form-field-maps.md
 * 12 signature/date fields across pages 9-11 + initial blocks on every prior page.
 */
export const LREC_101_FIELD_TEMPLATE: TemplateField[] = [
  // Buyer signatures (page 9)
  { type: "SIGNATURE", label: "Buyer Signature", page: 9, xPercent: 10, yPercent: 75, widthPercent: 35, heightPercent: 5, assignTo: "buyer", required: true },
  { type: "DATE", label: "Buyer Date", page: 9, xPercent: 55, yPercent: 75, widthPercent: 15, heightPercent: 4, assignTo: "buyer", required: true },
  { type: "SIGNATURE", label: "Co-Buyer Signature", page: 9, xPercent: 10, yPercent: 82, widthPercent: 35, heightPercent: 5, assignTo: "buyer_spouse", required: false },
  { type: "DATE", label: "Co-Buyer Date", page: 9, xPercent: 55, yPercent: 82, widthPercent: 15, heightPercent: 4, assignTo: "buyer_spouse", required: false },

  // Seller signatures (page 10)
  { type: "SIGNATURE", label: "Seller Signature", page: 10, xPercent: 10, yPercent: 25, widthPercent: 35, heightPercent: 5, assignTo: "seller", required: true },
  { type: "DATE", label: "Seller Date", page: 10, xPercent: 55, yPercent: 25, widthPercent: 15, heightPercent: 4, assignTo: "seller", required: true },
  { type: "SIGNATURE", label: "Co-Seller Signature", page: 10, xPercent: 10, yPercent: 32, widthPercent: 35, heightPercent: 5, assignTo: "seller_spouse", required: false },
  { type: "DATE", label: "Co-Seller Date", page: 10, xPercent: 55, yPercent: 32, widthPercent: 15, heightPercent: 4, assignTo: "seller_spouse", required: false },

  // Agent signatures (page 11)
  { type: "SIGNATURE", label: "Buyer Agent Signature", page: 11, xPercent: 10, yPercent: 60, widthPercent: 35, heightPercent: 5, assignTo: "buyer_agent", required: false },
  { type: "DATE", label: "Buyer Agent Date", page: 11, xPercent: 55, yPercent: 60, widthPercent: 15, heightPercent: 4, assignTo: "buyer_agent", required: false },
  { type: "SIGNATURE", label: "Seller Agent Signature", page: 11, xPercent: 10, yPercent: 75, widthPercent: 35, heightPercent: 5, assignTo: "seller_agent", required: false },
  { type: "DATE", label: "Seller Agent Date", page: 11, xPercent: 55, yPercent: 75, widthPercent: 15, heightPercent: 4, assignTo: "seller_agent", required: false },

  // Initials on every prior page (1-8) — bottom-right corner
  ...Array.from({ length: 8 }, (_, i): TemplateField => ({
    type: "INITIALS",
    label: `Initials page ${i + 1}`,
    page: i + 1,
    xPercent: 85,
    yPercent: 92,
    widthPercent: 8,
    heightPercent: 3,
    assignTo: "all_signers",
    required: false,
  })),
]

export interface FormTemplate {
  formType: string
  displayName: string
  fields: TemplateField[]
}

export const FORM_TEMPLATES: Record<string, FormTemplate> = {
  "lrec-101": {
    formType: "lrec-101",
    displayName: "LREC-101 — Louisiana Residential Agreement to Buy or Sell",
    fields: LREC_101_FIELD_TEMPLATE,
  },
}

/**
 * Map a document classifier result to a form template key.
 * Returns null if the classification doesn't match a template we have.
 */
export function templateKeyForClassification(docType: string | null | undefined): string | null {
  if (!docType) return null
  const normalized = docType.toLowerCase().replace(/[_\s]/g, "-")
  if (normalized === "purchase-agreement" || normalized === "lrec-101" || normalized === "lrec-001") {
    return "lrec-101"
  }
  return null
}

/**
 * Expand a template into concrete AirSignField rows for a given envelope.
 * Resolves `assignTo` roles against the actual signers on the envelope.
 *
 * Matching strategy:
 *  - "buyer"        → first signer whose role contains "buyer" (case-insensitive), else first signer
 *  - "seller"       → first signer whose role contains "seller", else second signer
 *  - "buyer_agent"  → signer whose role contains "buyer agent" / "listing agent"
 *  - "seller_agent" → signer whose role contains "seller agent" / "listing"
 *  - "buyer_spouse" → second signer whose role contains "buyer" (if any)
 *  - "seller_spouse"→ second signer whose role contains "seller" (if any)
 *  - "all_signers"  → assigned to the first signer (initials are typically one-per-page)
 *
 * Fields whose role can't be resolved are dropped (so a 1-signer envelope doesn't
 * get phantom co-buyer/co-seller fields).
 */
export function expandTemplate(
  templateKey: string,
  signers: Array<{ id: string; name: string; role: string; order: number }>,
  envelopeId: string,
  maxPage?: number
): Array<{
  envelopeId: string
  signerId: string
  type: TemplateFieldType
  label: string
  required: boolean
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
}> {
  const template = FORM_TEMPLATES[templateKey]
  if (!template) return []

  const buyers = signers.filter((s) => /buy|purchaser/i.test(s.role))
  const sellers = signers.filter((s) => /sell|vendor/i.test(s.role))
  const buyerAgents = signers.filter((s) => /buyer[\s_-]*agent|selling[\s_-]*agent/i.test(s.role))
  const sellerAgents = signers.filter((s) => /seller[\s_-]*agent|listing[\s_-]*agent/i.test(s.role))

  // Fallbacks when roles aren't explicit: use order
  const primary = signers[0]
  const secondary = signers[1]

  function resolve(role: TemplateSignerRole): string | null {
    switch (role) {
      case "buyer":        return (buyers[0] ?? primary)?.id ?? null
      case "buyer_spouse": return (buyers[1])?.id ?? null
      case "seller":       return (sellers[0] ?? secondary)?.id ?? null
      case "seller_spouse":return (sellers[1])?.id ?? null
      case "buyer_agent":  return (buyerAgents[0])?.id ?? null
      case "seller_agent": return (sellerAgents[0])?.id ?? null
      case "all_signers":  return (primary)?.id ?? null
      default:             return null
    }
  }

  const out: ReturnType<typeof expandTemplate> = []
  for (const f of template.fields) {
    // Drop fields whose target page is beyond the actual PDF length
    if (maxPage && f.page > maxPage) continue
    const signerId = resolve(f.assignTo)
    if (!signerId) continue
    out.push({
      envelopeId,
      signerId,
      type: f.type,
      label: f.label ?? f.type,
      required: f.required ?? false,
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
    })
  }
  return out
}
