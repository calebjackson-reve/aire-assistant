// lib/airsign/form-field-detector.ts
// Detects LREC form type from PDF metadata/name and returns fillable text field
// positions. These are the DATA fields (buyer name, address, price) — not the
// signature/initials fields that form-templates.ts handles.

import { FORM_REGISTRY, type FormField, type FormDefinition } from "@/lib/contracts/lrec-fields"

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface DetectedFormField {
  id: string
  label: string
  section: string
  type: "TEXT" | "DATE" | "CHECKBOX"
  page: number
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  /** The lrec-fields id for auto-fill mapping */
  fieldKey: string
  /** Pre-filled value (empty string if not filled) */
  value: string
}

export interface FormDetectionResult {
  detected: boolean
  formType: string | null
  formTitle: string | null
  fields: DetectedFormField[]
}

// ─── DETECTION ──────────────────────────────────────────────────────────────

/**
 * Detect which LREC form a document is based on name/classification.
 * Returns the fillable text fields (not signature fields — those come from form-templates.ts).
 */
export function detectFormFields(
  documentName: string,
  formTypeHint?: string | null
): FormDetectionResult {
  const formDef = resolveFormDefinition(documentName, formTypeHint)
  if (!formDef) {
    return { detected: false, formType: null, formTitle: null, fields: [] }
  }

  // Convert lrec-fields FormField entries to DetectedFormField,
  // excluding signature fields (handled by form-templates.ts)
  const fields: DetectedFormField[] = formDef.fields
    .filter(f => f.type !== "signature")
    .map(f => ({
      id: `fill_${f.id}`,
      label: f.label,
      section: f.section,
      type: mapFieldType(f.type),
      page: f.page,
      xPercent: f.xPercent,
      yPercent: f.yPercent,
      widthPercent: f.widthPercent,
      heightPercent: f.heightPercent,
      fieldKey: f.id,
      value: f.defaultValue ?? "",
    }))

  return {
    detected: true,
    formType: formDef.formId,
    formTitle: formDef.title,
    fields,
  }
}

/**
 * Apply auto-fill data (from buildAutoFillData) to detected fields.
 * Returns only fields that have a value.
 */
export function applyAutoFillToFields(
  detectedFields: DetectedFormField[],
  autoFillData: Record<string, string>
): DetectedFormField[] {
  return detectedFields.map(f => {
    const value = autoFillData[f.fieldKey] ?? f.value
    return { ...f, value }
  })
}

/**
 * Get page-aware field suggestions for the FieldPlacer.
 * Returns common field types/labels appropriate for the given page.
 */
export function getPageSuggestions(
  formType: string | null,
  page: number,
  totalPages: number
): Array<{ type: "TEXT" | "DATE" | "SIGNATURE" | "INITIALS" | "CHECKBOX"; label: string; fieldKey?: string }> {
  // If we know the form type, suggest fields from the definition
  if (formType) {
    const formDef = FORM_REGISTRY[formType]
    if (formDef) {
      return formDef.fields
        .filter(f => f.page === page)
        .map(f => ({
          type: f.type === "signature" ? "SIGNATURE" as const : mapFieldType(f.type),
          label: f.label,
          fieldKey: f.id,
        }))
    }
  }

  // Generic suggestions based on page position
  if (page === 1) {
    return [
      { type: "TEXT", label: "Buyer Name" },
      { type: "TEXT", label: "Seller Name" },
      { type: "TEXT", label: "Property Address" },
      { type: "TEXT", label: "City" },
      { type: "TEXT", label: "Parish" },
      { type: "TEXT", label: "Purchase Price" },
      { type: "TEXT", label: "MLS #" },
    ]
  }

  if (page === totalPages || page === totalPages - 1) {
    return [
      { type: "SIGNATURE", label: "Buyer Signature" },
      { type: "SIGNATURE", label: "Seller Signature" },
      { type: "DATE", label: "Date" },
      { type: "INITIALS", label: "Initials" },
    ]
  }

  // Middle pages
  return [
    { type: "TEXT", label: "Text Field" },
    { type: "DATE", label: "Date" },
    { type: "CHECKBOX", label: "Checkbox" },
    { type: "INITIALS", label: "Initials" },
  ]
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

function resolveFormDefinition(
  documentName: string,
  formTypeHint?: string | null
): FormDefinition | null {
  // Explicit hint takes priority
  if (formTypeHint) {
    const def = FORM_REGISTRY[formTypeHint.toLowerCase()]
    if (def) return def
  }

  // Try to detect from document name
  const lower = documentName.toLowerCase()

  if (lower.includes("lrec-101") || lower.includes("lrec101") || lower.includes("purchase agreement") || lower.includes("agreement to buy")) {
    return FORM_REGISTRY["lrec-101"]
  }
  if (lower.includes("lrec-102") || lower.includes("lrec102") || lower.includes("property disclosure") || lower.includes("disclosure document")) {
    return FORM_REGISTRY["lrec-102"]
  }
  if (lower.includes("lrec-103") || lower.includes("lrec103") || lower.includes("addendum") || lower.includes("amendment")) {
    return FORM_REGISTRY["lrec-103"]
  }

  return null
}

function mapFieldType(type: string): "TEXT" | "DATE" | "CHECKBOX" {
  switch (type) {
    case "date": return "DATE"
    case "boolean": return "CHECKBOX"
    default: return "TEXT"
  }
}
