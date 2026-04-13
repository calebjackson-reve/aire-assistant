/**
 * Loop Data Model — the canonical data vocabulary every AirSign template field binds to.
 * Single source of truth for fill keys. Adding a new form? Extend DATA_KEYS here first,
 * then the field-placement UI auto-suggests the right binding.
 *
 * Keys are dot-paths; arrays use [N]: loop.buyer[0].name, loop.buyer[1].name.
 */

export type DataKeyType = "string" | "number" | "date" | "boolean" | "enum"

export interface DataKeyDef {
  key: string
  label: string
  type: DataKeyType
  enumOptions?: readonly string[]
  group: "property" | "financials" | "dates" | "buyer" | "seller" | "listingAgent" | "buyingAgent" | "broker" | "title" | "lender" | "loop"
}

export const DATA_KEYS: readonly DataKeyDef[] = [
  { key: "loop.type", label: "Loop type", type: "enum", enumOptions: ["PURCHASE", "LISTING", "LEASE", "OTHER"], group: "loop" },
  { key: "loop.status", label: "Loop status", type: "string", group: "loop" },
  { key: "loop.mlsNumber", label: "MLS #", type: "string", group: "loop" },
  { key: "loop.property.streetNumber", label: "Street number", type: "string", group: "property" },
  { key: "loop.property.streetName", label: "Street name", type: "string", group: "property" },
  { key: "loop.property.unit", label: "Unit/Apt", type: "string", group: "property" },
  { key: "loop.property.city", label: "City", type: "string", group: "property" },
  { key: "loop.property.state", label: "State", type: "string", group: "property" },
  { key: "loop.property.zip", label: "ZIP", type: "string", group: "property" },
  { key: "loop.property.parish", label: "Parish (LA)", type: "string", group: "property" },
  { key: "loop.property.county", label: "County", type: "string", group: "property" },
  { key: "loop.property.legalDescription", label: "Legal description", type: "string", group: "property" },
  { key: "loop.property.bedrooms", label: "Bedrooms", type: "number", group: "property" },
  { key: "loop.property.bathrooms", label: "Bathrooms", type: "number", group: "property" },
  { key: "loop.property.sqft", label: "Sqft (living)", type: "number", group: "property" },
  { key: "loop.property.yearBuilt", label: "Year built", type: "number", group: "property" },
  { key: "loop.financials.listPrice", label: "List price", type: "number", group: "financials" },
  { key: "loop.financials.offerPrice", label: "Offer price", type: "number", group: "financials" },
  { key: "loop.financials.salePrice", label: "Sale / purchase price", type: "number", group: "financials" },
  { key: "loop.financials.earnestMoney", label: "Earnest money", type: "number", group: "financials" },
  { key: "loop.financials.downPayment", label: "Down payment", type: "number", group: "financials" },
  { key: "loop.financials.loanAmount", label: "Loan amount", type: "number", group: "financials" },
  { key: "loop.financials.loanType", label: "Loan type", type: "enum", enumOptions: ["CONVENTIONAL", "FHA", "VA", "USDA", "CASH", "OTHER"], group: "financials" },
  { key: "loop.dates.contract", label: "Contract date", type: "date", group: "dates" },
  { key: "loop.dates.offer", label: "Offer date", type: "date", group: "dates" },
  { key: "loop.dates.offerExpiration", label: "Offer expiration", type: "date", group: "dates" },
  { key: "loop.dates.inspection", label: "Inspection deadline", type: "date", group: "dates" },
  { key: "loop.dates.appraisal", label: "Appraisal deadline", type: "date", group: "dates" },
  { key: "loop.dates.financing", label: "Financing deadline", type: "date", group: "dates" },
  { key: "loop.dates.closing", label: "Closing date", type: "date", group: "dates" },
  { key: "loop.dates.possession", label: "Possession date", type: "date", group: "dates" },
  { key: "loop.buyer[0].name", label: "Buyer 1 name", type: "string", group: "buyer" },
  { key: "loop.buyer[0].email", label: "Buyer 1 email", type: "string", group: "buyer" },
  { key: "loop.buyer[0].phone", label: "Buyer 1 phone", type: "string", group: "buyer" },
  { key: "loop.buyer[0].address", label: "Buyer 1 address", type: "string", group: "buyer" },
  { key: "loop.buyer[1].name", label: "Buyer 2 name", type: "string", group: "buyer" },
  { key: "loop.buyer[1].email", label: "Buyer 2 email", type: "string", group: "buyer" },
  { key: "loop.seller[0].name", label: "Seller 1 name", type: "string", group: "seller" },
  { key: "loop.seller[0].email", label: "Seller 1 email", type: "string", group: "seller" },
  { key: "loop.seller[0].phone", label: "Seller 1 phone", type: "string", group: "seller" },
  { key: "loop.seller[1].name", label: "Seller 2 name", type: "string", group: "seller" },
  { key: "loop.seller[1].email", label: "Seller 2 email", type: "string", group: "seller" },
  { key: "loop.listingAgent.name", label: "Listing agent name", type: "string", group: "listingAgent" },
  { key: "loop.listingAgent.email", label: "Listing agent email", type: "string", group: "listingAgent" },
  { key: "loop.listingAgent.phone", label: "Listing agent phone", type: "string", group: "listingAgent" },
  { key: "loop.listingAgent.license", label: "Listing agent license #", type: "string", group: "listingAgent" },
  { key: "loop.listingAgent.brokerage", label: "Listing brokerage", type: "string", group: "listingAgent" },
  { key: "loop.buyingAgent.name", label: "Buying agent name", type: "string", group: "buyingAgent" },
  { key: "loop.buyingAgent.email", label: "Buying agent email", type: "string", group: "buyingAgent" },
  { key: "loop.buyingAgent.phone", label: "Buying agent phone", type: "string", group: "buyingAgent" },
  { key: "loop.buyingAgent.license", label: "Buying agent license #", type: "string", group: "buyingAgent" },
  { key: "loop.buyingAgent.brokerage", label: "Buying brokerage", type: "string", group: "buyingAgent" },
  { key: "loop.listingBroker.name", label: "Listing broker name", type: "string", group: "broker" },
  { key: "loop.listingBroker.license", label: "Listing broker license", type: "string", group: "broker" },
  { key: "loop.buyingBroker.name", label: "Buying broker name", type: "string", group: "broker" },
  { key: "loop.buyingBroker.license", label: "Buying broker license", type: "string", group: "broker" },
  { key: "loop.title.company", label: "Title company", type: "string", group: "title" },
  { key: "loop.title.contactName", label: "Title contact", type: "string", group: "title" },
  { key: "loop.title.contactEmail", label: "Title contact email", type: "string", group: "title" },
  { key: "loop.lender.company", label: "Lender company", type: "string", group: "lender" },
  { key: "loop.lender.contactName", label: "Lender contact", type: "string", group: "lender" },
]

export const DATA_KEY_MAP: Record<string, DataKeyDef> = Object.fromEntries(
  DATA_KEYS.map((d) => [d.key, d])
)

export function isValidDataKey(key: string): boolean {
  return key in DATA_KEY_MAP
}

/** Resolve a dot-path (with optional [N] array indexes) against a loopData object. */
export function resolveDataKey(loopData: unknown, key: string): unknown {
  if (!loopData || typeof loopData !== "object") return undefined
  const parts = key.split(".")
  let cur: unknown = loopData
  for (const raw of parts) {
    if (cur == null) return undefined
    const m = raw.match(/^([^\[]+)(?:\[(\d+)\])?$/)
    if (!m) return undefined
    const prop = m[1]
    const idx = m[2]
    if (typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[prop]
    if (idx !== undefined) {
      if (!Array.isArray(cur)) return undefined
      cur = cur[Number(idx)]
    }
  }
  return cur
}

/** Seed a loopData blob from a legacy Transaction row. */
export function loopDataFromTransaction(txn: {
  propertyAddress?: string | null
  propertyCity?: string | null
  propertyState?: string | null
  propertyZip?: string | null
  mlsNumber?: string | null
  listPrice?: number | null
  offerPrice?: number | null
  acceptedPrice?: number | null
  buyerName?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  sellerName?: string | null
  sellerEmail?: string | null
  sellerPhone?: string | null
  lenderName?: string | null
  titleCompany?: string | null
  contractDate?: Date | null
  inspectionDeadline?: Date | null
  appraisalDeadline?: Date | null
  financingDeadline?: Date | null
  closingDate?: Date | null
}) {
  const parts = (txn.propertyAddress || "").trim().split(" ")
  const streetNumber = /^\d/.test(parts[0] || "") ? parts[0] : ""
  const streetName = streetNumber ? parts.slice(1).join(" ") : (txn.propertyAddress || "")

  return {
    loop: {
      mlsNumber: txn.mlsNumber || undefined,
      property: {
        streetNumber: streetNumber || undefined,
        streetName: streetName || undefined,
        city: txn.propertyCity || undefined,
        state: txn.propertyState || undefined,
        zip: txn.propertyZip || undefined,
      },
      financials: {
        listPrice: txn.listPrice || undefined,
        offerPrice: txn.offerPrice || undefined,
        salePrice: txn.acceptedPrice || undefined,
      },
      dates: {
        contract: txn.contractDate?.toISOString() || undefined,
        inspection: txn.inspectionDeadline?.toISOString() || undefined,
        appraisal: txn.appraisalDeadline?.toISOString() || undefined,
        financing: txn.financingDeadline?.toISOString() || undefined,
        closing: txn.closingDate?.toISOString() || undefined,
      },
      buyer: txn.buyerName
        ? [{ name: txn.buyerName, email: txn.buyerEmail || undefined, phone: txn.buyerPhone || undefined }]
        : [],
      seller: txn.sellerName
        ? [{ name: txn.sellerName, email: txn.sellerEmail || undefined, phone: txn.sellerPhone || undefined }]
        : [],
      title: txn.titleCompany ? { company: txn.titleCompany } : undefined,
      lender: txn.lenderName ? { company: txn.lenderName } : undefined,
    },
  }
}

/** Deep-merge helper used by autofill patches. */
export function deepMergeLoopData<T extends Record<string, unknown>>(
  a: T,
  b: Record<string, unknown>
): T {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const av = out[k]
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      av &&
      typeof av === "object" &&
      !Array.isArray(av)
    ) {
      out[k] = deepMergeLoopData(av as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out as T
}
