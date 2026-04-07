/**
 * Agent Profile — auto-fills agent/brokerage info on every contract.
 * In production this comes from the user's DB record + onboarding data.
 * For now, hardcoded for Caleb Jackson / Reve REALTORS.
 */

export interface AgentProfile {
  name: string
  licenseNumber: string
  brokerageName: string
  brokerageLicenseNumber: string
  phone: string
  brokeragePhone: string
  email: string
  // Auto-fill defaults
  defaultParish: string
  defaultCity: string
  defaultState: string
}

// Caleb's profile — used as the selling/buying agent on all contracts
export const AGENT_PROFILE: AgentProfile = {
  name: "Caleb Jackson",
  licenseNumber: "995709547",
  brokerageName: "Reve REALTORS",
  brokerageLicenseNumber: "995699366",
  phone: "225-747-0303",
  brokeragePhone: "504-300-0700",
  email: "caleb.jackson@reverealtors.com",
  defaultParish: "East Baton Rouge",
  defaultCity: "Baton Rouge",
  defaultState: "LA",
}

/**
 * Maps agent profile + deal data to LREC-101 field values.
 * Returns a Record<fieldId, value> ready to pass to the contract writer.
 */
export function buildAutoFillData(
  profile: AgentProfile,
  deal: {
    address: string
    city?: string
    state?: string
    zip?: string
    parish?: string
    legalDescription?: string
    mlsNumber?: string
    buyerName?: string
    buyerEmail?: string
    buyerPhone?: string
    sellerName?: string
    sellerEmail?: string
    sellerPhone?: string
    purchasePrice?: number
    earnestMoney?: number
    financingType?: string
    contractDate?: string
    closingDate?: string
    inspectionDays?: number
    appraisalDays?: number
    financingDays?: number
    mineralRights?: boolean
    titleCompany?: string
    agentSide?: "buyer" | "seller" | "dual"
    otherAgentName?: string
    otherAgentLicense?: string
    otherBrokerage?: string
    otherBrokeragePhone?: string
    otherAgentEmail?: string
  }
): Record<string, string> {
  const fields: Record<string, string> = {}

  // Property
  fields.property_address = deal.address
  fields.property_city = deal.city || profile.defaultCity
  fields.property_parish = deal.parish || profile.defaultParish
  fields.property_zip = deal.zip || ""
  if (deal.legalDescription) fields.legal_description = deal.legalDescription
  if (deal.mlsNumber) fields.mls_number = deal.mlsNumber

  // Parties
  if (deal.buyerName) fields.buyer_name = deal.buyerName
  if (deal.buyerEmail) fields.buyer_email = deal.buyerEmail
  if (deal.buyerPhone) fields.buyer_phone = deal.buyerPhone
  if (deal.sellerName) fields.seller_name = deal.sellerName
  if (deal.sellerEmail) fields.seller_email = deal.sellerEmail
  if (deal.sellerPhone) fields.seller_phone = deal.sellerPhone

  // Price & Terms
  if (deal.purchasePrice) fields.purchase_price = `$${deal.purchasePrice.toLocaleString()}`
  if (deal.earnestMoney) fields.earnest_money = `$${deal.earnestMoney.toLocaleString()}`
  if (deal.financingType) fields.financing_type = deal.financingType

  // Dates
  if (deal.contractDate) fields.contract_date = deal.contractDate
  if (deal.closingDate) fields.closing_date = deal.closingDate
  fields.inspection_days = String(deal.inspectionDays ?? 14)
  fields.appraisal_days = String(deal.appraisalDays ?? 14)
  fields.financing_days = String(deal.financingDays ?? 25)

  // Louisiana-specific
  if (deal.titleCompany) fields.title_company = deal.titleCompany
  fields.title_insurance_paid_by = "Seller"
  fields.termite_inspection = "true"

  // Agent info — always auto-filled from profile
  if (deal.agentSide === "seller" || deal.agentSide === "dual") {
    fields.listing_agent_name = profile.name
    fields.listing_agent_license = profile.licenseNumber
    fields.listing_brokerage = `${profile.brokerageName} — ${profile.brokerageLicenseNumber}`
  }
  if (deal.agentSide === "buyer" || deal.agentSide === "dual") {
    fields.selling_agent_name = profile.name
    fields.selling_agent_license = profile.licenseNumber
    fields.selling_brokerage = `${profile.brokerageName} — ${profile.brokerageLicenseNumber}`
  }

  // Other agent (if not dual)
  if (deal.otherAgentName) {
    if (deal.agentSide === "buyer") {
      fields.listing_agent_name = deal.otherAgentName
      if (deal.otherAgentLicense) fields.listing_agent_license = deal.otherAgentLicense
      if (deal.otherBrokerage) fields.listing_brokerage = deal.otherBrokerage
    } else if (deal.agentSide === "seller") {
      fields.selling_agent_name = deal.otherAgentName
      if (deal.otherAgentLicense) fields.selling_agent_license = deal.otherAgentLicense
      if (deal.otherBrokerage) fields.selling_brokerage = deal.otherBrokerage
    }
  }

  return fields
}
