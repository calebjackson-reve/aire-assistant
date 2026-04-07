/**
 * AIRE MLS Auto-Fill Engine
 * Extracts property data from documents (appraisals, old listings)
 * and maps to Paragon MLS field numbers.
 */

import Anthropic from "@anthropic-ai/sdk"
import { PARAGON_FIELDS, type ParagonField } from "./field-definitions"

const anthropic = new Anthropic()

export interface MLSFieldValue {
  field: ParagonField
  value: string | number | boolean | null
  confidence: "high" | "medium" | "low"
  source: string  // "appraisal" | "listing" | "user_profile" | "manual"
}

export interface MLSAutoFillResult {
  filled: MLSFieldValue[]
  missing: ParagonField[]
  totalRequired: number
  totalFilled: number
  completionPct: number
}

/**
 * Extract MLS fields from a document (PDF text or image-extracted text).
 * Uses Claude to parse the document and map to Paragon field numbers.
 */
export async function extractMLSFields(
  documentText: string,
  documentType: "appraisal" | "old_listing" | "property_disclosure" | "other",
  agentProfile?: { name: string; office: string }
): Promise<MLSAutoFillResult> {
  const fieldNames = PARAGON_FIELDS.map(f =>
    `${f.fieldNumber}: ${f.name} (${f.type}${f.options ? ` — options: ${f.options.join(", ")}` : ""})`
  ).join("\n")

  const prompt = `You are a Louisiana real estate data extraction specialist. Extract ALL Paragon MLS listing fields from this ${documentType} document.

PARAGON MLS FIELDS TO EXTRACT:
${fieldNames}

DOCUMENT TEXT:
${documentText.slice(0, 12000)}

RULES:
- For dropdown fields, pick the CLOSEST matching option from the provided options list
- For "Apprx. Age", calculate from Year Built if given (e.g., built 2015 in 2026 = "11-15 Years")
- For "Source SqFt", default to "Appraisal" if extracting from an appraisal
- For "UTILGAS", look for mentions of gas/propane/electric-only
- For "WATER/SEWER", look for well, septic, city water mentions
- If a field value is not found in the document, set it to null
- Return confidence: "high" if explicitly stated, "medium" if inferred, "low" if guessed

Return ONLY valid JSON:
{
  "fields": {
    "<field_number>": { "value": "...", "confidence": "high|medium|low" },
    ...
  }
}
`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : "{}"
  let parsed: { fields: Record<string, { value: string | number | null; confidence: string }> }
  try {
    parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim())
  } catch {
    parsed = { fields: {} }
  }

  // Map results to ParagonField structures
  const filled: MLSFieldValue[] = []
  const missing: ParagonField[] = []

  for (const field of PARAGON_FIELDS) {
    const key = String(field.fieldNumber)
    const extracted = parsed.fields[key]

    if (extracted?.value != null && extracted.value !== "") {
      filled.push({
        field,
        value: extracted.value,
        confidence: (extracted.confidence as "high" | "medium" | "low") || "medium",
        source: documentType,
      })
    } else if (field.required) {
      missing.push(field)
    }
  }

  // Auto-fill agent info from profile
  if (agentProfile) {
    const agentField = PARAGON_FIELDS.find(f => f.fieldNumber === 168)
    const officeField = PARAGON_FIELDS.find(f => f.fieldNumber === 167)
    if (agentField && !filled.some(f => f.field.fieldNumber === 168)) {
      filled.push({ field: agentField, value: agentProfile.name, confidence: "high", source: "user_profile" })
    }
    if (officeField && !filled.some(f => f.field.fieldNumber === 167)) {
      filled.push({ field: officeField, value: agentProfile.office, confidence: "high", source: "user_profile" })
    }
  }

  const totalRequired = PARAGON_FIELDS.filter(f => f.required).length
  const totalFilled = filled.filter(f => f.field.required).length

  return {
    filled,
    missing: missing.filter(m => !filled.some(f => f.field.fieldNumber === m.fieldNumber)),
    totalRequired,
    totalFilled,
    completionPct: Math.round((totalFilled / totalRequired) * 100),
  }
}

/**
 * Convert MLSAutoFillResult to a flat object for Transaction model update.
 */
export function toTransactionUpdate(result: MLSAutoFillResult): Record<string, unknown> {
  const update: Record<string, unknown> = {}

  for (const item of result.filled) {
    if (item.field.transactionField) {
      update[item.field.transactionField] = item.value
    }
  }

  return update
}
