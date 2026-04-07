/**
 * Paragon MLS Field Definitions — Greater Baton Rouge (GBRAR)
 * Every required field with its Paragon field number, type, and options.
 */

export interface ParagonField {
  fieldNumber: number | string  // Paragon field number (68, 70, etc.) or code (E, J, etc.)
  name: string
  section: "location" | "property_details" | "features" | "agent_info"
  type: "text" | "number" | "decimal" | "dropdown" | "pick_list" | "boolean"
  required: boolean
  options?: string[]  // For dropdowns/pick lists
  transactionField?: string  // Maps to Transaction model field
  extractionKey?: string  // Maps to document extraction field name
}

export const PARAGON_FIELDS: ParagonField[] = [
  // ── Location Section ──
  { fieldNumber: 68, name: "Address", section: "location", type: "text", required: true, transactionField: "propertyAddress", extractionKey: "address" },
  { fieldNumber: 70, name: "City", section: "location", type: "text", required: true, transactionField: "propertyCity", extractionKey: "city" },
  { fieldNumber: 71, name: "State", section: "location", type: "dropdown", required: true, options: ["LA"], transactionField: "propertyState", extractionKey: "state" },
  { fieldNumber: 72, name: "Zip", section: "location", type: "text", required: true, transactionField: "propertyZip", extractionKey: "zip" },
  { fieldNumber: 225, name: "Tax ID", section: "location", type: "text", required: true, transactionField: "taxId", extractionKey: "tax_id" },
  { fieldNumber: 84, name: "Lot #", section: "location", type: "text", required: true, transactionField: "lotNumber", extractionKey: "lot_number" },
  { fieldNumber: 85, name: "Subdivision", section: "location", type: "text", required: true, transactionField: "subdivision", extractionKey: "subdivision" },
  { fieldNumber: 86, name: "School System", section: "location", type: "text", required: true, transactionField: "schoolSystem", extractionKey: "school_system" },

  // ── Property Details Section ──
  { fieldNumber: 89, name: "Beds", section: "property_details", type: "number", required: true, transactionField: "bedroomCount", extractionKey: "bedrooms" },
  { fieldNumber: 90, name: "Baths Full", section: "property_details", type: "number", required: true, transactionField: "bathroomsFull", extractionKey: "bathrooms_full" },
  { fieldNumber: 105, name: "SqFt Living", section: "property_details", type: "number", required: true, transactionField: "sqftLiving", extractionKey: "sqft_living" },
  { fieldNumber: 102, name: "#Stories", section: "property_details", type: "dropdown", required: true, options: ["1", "1.5", "2", "2.5", "3", "3+"], transactionField: "stories", extractionKey: "stories" },
  { fieldNumber: 94, name: "Lower SqFt", section: "property_details", type: "number", required: true, transactionField: "sqftLower", extractionKey: "sqft_lower" },
  { fieldNumber: 96, name: "Apx Total SqFt", section: "property_details", type: "number", required: true, transactionField: "sqftTotal", extractionKey: "sqft_total" },
  { fieldNumber: 112, name: "Source SqFt", section: "property_details", type: "dropdown", required: true, options: ["Appraisal", "Assessment", "Agent Measured", "Estimated", "Other"], transactionField: "sqftSource", extractionKey: "sqft_source" },
  { fieldNumber: 115, name: "Apprx. Age", section: "property_details", type: "dropdown", required: true, options: ["New Construction", "Under 1 Year", "1-5 Years", "6-10 Years", "11-15 Years", "16-25 Years", "26-50 Years", "Over 50 Years"], transactionField: "approxAge", extractionKey: "approx_age" },
  { fieldNumber: 110, name: "Lot Dimensions", section: "property_details", type: "text", required: true, transactionField: "lotDimensions", extractionKey: "lot_dimensions" },
  { fieldNumber: 111, name: "Acres", section: "property_details", type: "decimal", required: true, transactionField: "acres", extractionKey: "acres" },

  // ── Features Section ──
  { fieldNumber: "E", name: "COOLING", section: "features", type: "pick_list", required: true, options: ["Central A/C", "Window Unit", "None"], transactionField: "featureCooling", extractionKey: "cooling" },
  { fieldNumber: "J", name: "FINANCING", section: "features", type: "pick_list", required: true, options: ["Conventional", "FHA", "VA", "USDA", "Cash", "Owner Financing", "Other"], extractionKey: "financing" },
  { fieldNumber: "M", name: "FOUNDATION", section: "features", type: "pick_list", required: true, options: ["Slab", "Raised Slab", "Pier & Beam", "Crawl Space", "Basement", "Other"], transactionField: "featureFoundation", extractionKey: "foundation" },
  { fieldNumber: "N", name: "HEATING", section: "features", type: "pick_list", required: true, options: ["Central", "Floor Furnace", "Space Heater", "Wall Heater", "Radiant", "None"], transactionField: "featureHeating", extractionKey: "heating" },
  { fieldNumber: "U", name: "PARKING", section: "features", type: "pick_list", required: true, options: ["Attached Garage", "Detached Garage", "Carport", "Covered", "Off-Street", "None"], transactionField: "featureParking", extractionKey: "parking" },
  { fieldNumber: "Z", name: "SIDING", section: "features", type: "pick_list", required: true, options: ["Brick", "Brick/Wood", "Vinyl", "Wood", "Stucco", "Cement Board", "Metal", "Other"], transactionField: "featureSiding", extractionKey: "siding" },
  { fieldNumber: "AA", name: "STYLE", section: "features", type: "pick_list", required: true, options: ["Ranch", "Colonial", "French Provincial", "Acadian", "Contemporary", "Cottage", "Raised", "Split Level", "Other"], transactionField: "featureStyle", extractionKey: "style" },
  { fieldNumber: "AD", name: "UTILGAS", section: "features", type: "pick_list", required: true, options: ["Natural Gas", "Propane", "None"], transactionField: "featureUtilGas", extractionKey: "util_gas" },
  { fieldNumber: "AE", name: "UTILELEC", section: "features", type: "pick_list", required: true, options: ["Entergy", "DEMCO", "CLECO", "Other"], transactionField: "featureUtilElec", extractionKey: "util_electric" },
  { fieldNumber: "AF", name: "WATER/SEWER", section: "features", type: "pick_list", required: true, options: ["City Water/Sewer", "Well/Septic", "City Water/Septic", "Well/Sewer", "Other"], transactionField: "featureWaterSewer", extractionKey: "water_sewer" },

  // ── Seller & Agent Info ──
  { fieldNumber: 168, name: "List Agent", section: "agent_info", type: "text", required: true, extractionKey: "list_agent" },
  { fieldNumber: 167, name: "List Office", section: "agent_info", type: "text", required: true, extractionKey: "list_office" },
  { fieldNumber: 171, name: "Occupied By", section: "agent_info", type: "dropdown", required: true, options: ["Owner", "Tenant", "Vacant", "Builder"], transactionField: "occupiedBy", extractionKey: "occupied_by" },
  { fieldNumber: 173, name: "List Type", section: "agent_info", type: "dropdown", required: true, options: ["Exclusive Right to Sell", "Exclusive Agency", "Open Listing", "Net Listing"], transactionField: "listType", extractionKey: "list_type" },
  { fieldNumber: 172, name: "Limited Service", section: "agent_info", type: "dropdown", required: true, options: ["Yes", "No"], transactionField: "limitedService", extractionKey: "limited_service" },
  { fieldNumber: "Y", name: "SHOWING", section: "agent_info", type: "text", required: true, transactionField: "showingInstructions", extractionKey: "showing" },
]

/** Get all required fields */
export function getRequiredFields(): ParagonField[] {
  return PARAGON_FIELDS.filter(f => f.required)
}

/** Get fields by section */
export function getFieldsBySection(section: ParagonField["section"]): ParagonField[] {
  return PARAGON_FIELDS.filter(f => f.section === section)
}

/** Get field by Paragon number */
export function getField(fieldNumber: number | string): ParagonField | undefined {
  return PARAGON_FIELDS.find(f => f.fieldNumber === fieldNumber)
}
