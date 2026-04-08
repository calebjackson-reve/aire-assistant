/**
 * AIRE Contract Writing Engine — Core Writer
 * Takes natural language or structured input → produces filled LREC PDF.
 *
 * Two modes:
 *   1. NL mode: "Write PA for 123 Main St, buyer John Smith, $200K, close May 15"
 *   2. Structured mode: Direct field values passed in
 *
 * Pipeline: parse NL → resolve fields → select clauses → validate → generate PDF
 */

import Anthropic from "@anthropic-ai/sdk"
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib"
import { getFormDefinition, type FormField, type FormDefinition, LOUISIANA_PARISHES } from "./lrec-fields"
import { selectClauses, substituteVariables, type ClauseContext, type Clause } from "./clause-library"
import { calculateDeadlines } from "@/lib/louisiana-rules-engine"
import { withCircuitBreaker } from "@/lib/learning/circuit-breaker"
import { logError } from "@/lib/learning/error-memory"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ContractRequest {
  formType: string                   // "lrec-101", "purchase_agreement", etc.
  naturalLanguage?: string           // NL command (if present, fields are parsed from this)
  fields?: Record<string, string>    // Structured field values (direct or from NL parse)
  clauses?: string[]                 // Additional clause IDs to include
  transactionId?: string             // Link to existing transaction
  userId?: string
}

export interface ContractResult {
  pdfBuffer: Buffer
  filename: string
  pageCount: number
  formType: string
  fields: Record<string, string>
  clauses: string[]
  validation: ValidationResult
  timing: { parseMs: number; generateMs: number; totalMs: number }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── NL PARSER ──────────────────────────────────────────────────────────────

const NL_SYSTEM_PROMPT = `You are AIRE's contract field parser for Louisiana real estate.
Extract structured fields from natural language. Return ONLY JSON.

Field keys: property_address, property_city, property_parish, property_zip,
buyer_name, seller_name, purchase_price, earnest_money, contract_date, closing_date,
inspection_days, appraisal_days, financing_days, financing_type, loan_amount,
title_company, mls_number, property_type, special_conditions,
listing_agent_name, selling_agent_name, home_warranty (true/false),
appliances_included, exclusions, flood_zone, lender_name

Rules:
- Dates: "May 15" → "05/15/2026" (assume current year)
- Currency: "$200K" → "200000", "two fifty" → "250000"
- Inspection: "7 days" → inspection_days: "7"
- Default inspection_days: "14", financing_days: "25", appraisal_days: "14"
- "cash deal" or "cash purchase" → financing_type: "cash"
- Parish defaults to "East Baton Rouge" if not specified
- "Act of Sale" = closing_date

Return: {"fields": {...}, "detected_form": "lrec-101|lrec-103", "confidence": 0.0-1.0}`

export async function parseNaturalLanguage(text: string): Promise<{
  fields: Record<string, string>
  detectedForm: string
  confidence: number
}> {
  const cbResult = await withCircuitBreaker(
    () => anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: NL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
    {
      agentName: "contract_writer",
      maxRetries: 2,
      fallback: async () => null, // Fall back to empty fields below
    }
  )

  if ("error" in cbResult || cbResult.result === null) {
    const errorMsg = "error" in cbResult ? cbResult.error : "Circuit breaker fallback"
    await logError({ agentName: "contract_writer", error: errorMsg, context: { phase: "nl_parse", inputLength: text.length } }).catch(() => {})
    return { fields: {}, detectedForm: "lrec-101", confidence: 0 }
  }

  const raw = cbResult.result.content[0]?.type === "text" ? cbResult.result.content[0].text : "{}"
  try {
    const cleaned = raw.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    const parsed = JSON.parse(cleaned)
    return {
      fields: parsed.fields || {},
      detectedForm: parsed.detected_form || "lrec-101",
      confidence: parsed.confidence || 0,
    }
  } catch (err) {
    await logError({ agentName: "contract_writer", error: err instanceof Error ? err : String(err), context: { phase: "nl_parse_json" } }).catch(() => {})
    return { fields: {}, detectedForm: "lrec-101", confidence: 0 }
  }
}

// ─── FIELD RESOLUTION ───────────────────────────────────────────────────────

function resolveDefaults(fields: Record<string, string>, formDef: FormDefinition): Record<string, string> {
  const resolved = { ...fields }

  for (const field of formDef.fields) {
    if (!resolved[field.id] && field.defaultValue) {
      resolved[field.id] = field.defaultValue
    }
  }

  // Auto-calculate deadlines if contract date provided
  if (resolved.contract_date && !resolved.closing_date) {
    const contractDate = new Date(resolved.contract_date)
    if (!isNaN(contractDate.getTime())) {
      const deadlines = calculateDeadlines({
        contractDate,
        inspectionDays: parseInt(resolved.inspection_days || "14"),
        appraisalDays: parseInt(resolved.appraisal_days || "14"),
        financingDays: parseInt(resolved.financing_days || "25"),
      })
      const closing = deadlines.find(d => d.name === "Closing / Act of Sale")
      if (closing) {
        resolved.closing_date = closing.dueDate.toLocaleDateString("en-US")
      }
    }
  }

  // Validate parish
  if (resolved.property_parish) {
    const match = LOUISIANA_PARISHES.find(p =>
      p.toLowerCase() === resolved.property_parish.toLowerCase()
    )
    if (match) resolved.property_parish = match
  }

  // Caleb's defaults
  if (!resolved.selling_agent_name) resolved.selling_agent_name = "Caleb Jackson"
  if (!resolved.selling_brokerage) resolved.selling_brokerage = "Reve Realtors"

  return resolved
}

// ─── VALIDATION ─────────────────────────────────────────────────────────────

export function validateContract(fields: Record<string, string>, formDef: FormDefinition): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  for (const field of formDef.fields) {
    if (field.required && field.type !== "signature" && !fields[field.id]) {
      errors.push(`Missing required field: ${field.label}`)
    }
  }

  // Date logic checks
  if (fields.contract_date && fields.closing_date) {
    const contract = new Date(fields.contract_date)
    const closing = new Date(fields.closing_date)
    if (closing <= contract) {
      errors.push("Closing date must be after contract date")
    }
    const daysBetween = Math.ceil((closing.getTime() - contract.getTime()) / 86400000)
    if (daysBetween < 14) {
      warnings.push(`Only ${daysBetween} days between contract and closing — may be tight for inspections/financing`)
    }
    if (daysBetween > 120) {
      warnings.push(`${daysBetween} days between contract and closing — unusually long timeline`)
    }
  }

  // Price checks
  if (fields.purchase_price) {
    const price = parseFloat(fields.purchase_price.replace(/[^0-9.]/g, ""))
    if (price < 10000) warnings.push("Purchase price is unusually low — verify amount")
    if (price > 5000000) warnings.push("Purchase price exceeds $5M — verify amount")

    if (fields.earnest_money) {
      const earnest = parseFloat(fields.earnest_money.replace(/[^0-9.]/g, ""))
      if (earnest < price * 0.005) warnings.push("Earnest money is less than 0.5% of purchase price")
      if (earnest > price * 0.1) warnings.push("Earnest money exceeds 10% of purchase price")
    }
  }

  // Louisiana-specific
  if (fields.property_parish && !LOUISIANA_PARISHES.includes(fields.property_parish)) {
    warnings.push(`"${fields.property_parish}" is not a recognized Louisiana parish`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── PDF GENERATION ─────────────────────────────────────────────────────────

async function generateContractPDF(
  formDef: FormDefinition,
  fields: Record<string, string>,
  clauses: Clause[]
): Promise<{ buffer: Buffer; pageCount: number }> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const MARGIN = 50
  const PAGE_W = 612
  const PAGE_H = 792

  function newPage(): { page: PDFPage; y: number } {
    const page = doc.addPage([PAGE_W, PAGE_H])
    return { page, y: PAGE_H - 50 }
  }

  // Sanitize text for WinAnsi encoding (StandardFonts.Helvetica can't render most Unicode)
  function sanitize(text: string): string {
    return text
      .replace(/[\u2010-\u2015]/g, "-")      // hyphens, en/em dashes
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // curly single quotes
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // curly double quotes
      .replace(/\u2026/g, "...")              // ellipsis
      .replace(/[\u2022\u2023\u25E6]/g, "*")  // bullets
      .replace(/[\u2611\u2713]/g, "[X]")      // checkmarks
      .replace(/[\u2610\u25A1]/g, "[ ]")      // empty checkboxes
      .replace(/\u2192/g, "->")               // right arrow
      .replace(/\u2190/g, "<-")               // left arrow
      .replace(/[\u00A0]/g, " ")              // non-breaking space
      .replace(/[^\x20-\x7E\r\n\t]/g, "?")    // any remaining non-ASCII -> ?
  }

  function drawText(page: PDFPage, text: string, x: number, y: number, size: number, f: PDFFont, color = rgb(0, 0, 0)) {
    page.drawText(sanitize(text), { x, y, size, font: f, color, maxWidth: PAGE_W - x - MARGIN })
  }

  // ── Page 1: Header + Form Title ──
  let { page, y } = newPage()

  // AIRE header bar
  page.drawRectangle({ x: 0, y: PAGE_H - 35, width: PAGE_W, height: 35, color: rgb(0.604, 0.671, 0.494) })
  drawText(page, `${formDef.formNumber} - ${formDef.title}`, MARGIN, PAGE_H - 25, 11, bold, rgb(0.96, 0.95, 0.92))

  y = PAGE_H - 55
  drawText(page, `DRAFT - Generated by AIRE Intelligence - ${new Date().toLocaleDateString("en-US")}`, MARGIN, y, 8, font, rgb(0.42, 0.49, 0.32))
  y -= 25

  // ── Render fields by section ──
  const sections = [...new Set(formDef.fields.filter(f => f.type !== "signature").map(f => f.section))]

  for (const section of sections) {
    const sectionFields = formDef.fields.filter(f => f.section === section && f.type !== "signature")
    if (sectionFields.length === 0) continue

    // Section header
    if (y < 100) { const np = newPage(); page = np.page; y = np.y }

    const sectionTitle = section.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    drawText(page, sectionTitle, MARGIN, y, 10, bold, rgb(0.42, 0.49, 0.32))
    page.drawLine({ start: { x: MARGIN, y: y - 3 }, end: { x: PAGE_W - MARGIN, y: y - 3 }, thickness: 0.5, color: rgb(0.604, 0.671, 0.494) })
    y -= 18

    for (const field of sectionFields) {
      if (y < 80) { const np = newPage(); page = np.page; y = np.y }

      const value = fields[field.id] || ""

      // Label
      drawText(page, field.label, MARGIN, y, 7, font, rgb(0.4, 0.4, 0.4))
      y -= 12

      // Value or blank line
      if (value) {
        // Format based on type
        let displayValue = value
        if (field.type === "currency" && !value.startsWith("$")) {
          const num = parseFloat(value.replace(/[^0-9.]/g, ""))
          displayValue = isNaN(num) ? value : `$${num.toLocaleString()}`
        }
        if (field.type === "boolean") {
          displayValue = value === "true" ? "[X] Yes" : "[ ] No"
        }

        drawText(page, displayValue, MARGIN, y, 10, bold)
      } else {
        page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: MARGIN + 200, y: y + 2 }, thickness: 0.3, color: rgb(0.7, 0.7, 0.7) })
      }
      y -= 16
    }

    y -= 8
  }

  // ── Clauses Section ──
  if (clauses.length > 0) {
    if (y < 200) { const np = newPage(); page = np.page; y = np.y }

    drawText(page, "TERMS AND CONDITIONS", MARGIN, y, 10, bold, rgb(0.42, 0.49, 0.32))
    page.drawLine({ start: { x: MARGIN, y: y - 3 }, end: { x: PAGE_W - MARGIN, y: y - 3 }, thickness: 0.5, color: rgb(0.604, 0.671, 0.494) })
    y -= 20

    for (const clause of clauses) {
      if (y < 100) { const np = newPage(); page = np.page; y = np.y }

      // Clause title
      drawText(page, clause.title, MARGIN, y, 8, bold, rgb(0.1, 0.14, 0.09))
      y -= 14

      // Clause text with variables substituted
      const text = substituteVariables(clause.text, fields)
      const words = text.split(/\s+/)
      let line = ""

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word
        const width = font.widthOfTextAtSize(testLine, 9)
        if (width > PAGE_W - MARGIN * 2 && line) {
          if (y < 60) { const np = newPage(); page = np.page; y = np.y }
          drawText(page, line, MARGIN, y, 9, font)
          y -= 13
          line = word
        } else {
          line = testLine
        }
      }
      if (line) {
        if (y < 60) { const np = newPage(); page = np.page; y = np.y }
        drawText(page, line, MARGIN, y, 9, font)
        y -= 13
      }

      y -= 10
    }
  }

  // ── Signature Section ──
  { const np = newPage(); page = np.page; y = np.y }

  drawText(page, "SIGNATURES", MARGIN, y, 10, bold, rgb(0.42, 0.49, 0.32))
  page.drawLine({ start: { x: MARGIN, y: y - 3 }, end: { x: PAGE_W - MARGIN, y: y - 3 }, thickness: 0.5, color: rgb(0.604, 0.671, 0.494) })
  y -= 30

  const sigFields = formDef.fields.filter(f => f.type === "signature")
  for (const sig of sigFields) {
    drawText(page, sig.label, MARGIN, y + 14, 7, font, rgb(0.4, 0.4, 0.4))
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 220, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    drawText(page, "Date:", MARGIN + 240, y + 14, 7, font, rgb(0.4, 0.4, 0.4))
    page.drawLine({ start: { x: MARGIN + 270, y }, end: { x: MARGIN + 400, y }, thickness: 0.5, color: rgb(0, 0, 0) })
    y -= 40
  }

  // Footer
  drawText(page, "This is a DRAFT document generated by AIRE Intelligence. Not legally binding until executed by all parties via Act of Sale before a Notary Public.", MARGIN, 35, 6.5, font, rgb(0.5, 0.5, 0.5))

  const bytes = await doc.save()
  return { buffer: Buffer.from(bytes), pageCount: doc.getPageCount() }
}

// ─── MAIN: WRITE CONTRACT ───────────────────────────────────────────────────

export async function writeContract(req: ContractRequest): Promise<ContractResult> {
  const totalStart = Date.now()

  // Step 1: Parse NL if provided
  let fields = req.fields || {}
  let formType = req.formType
  let parseMs = 0

  if (req.naturalLanguage) {
    const t0 = Date.now()
    const parsed = await parseNaturalLanguage(req.naturalLanguage)
    parseMs = Date.now() - t0
    fields = { ...parsed.fields, ...fields } // explicit fields override NL
    if (!formType || formType === "auto") formType = parsed.detectedForm
  }

  // Step 2: Resolve form definition
  const formDef = getFormDefinition(formType)
  if (!formDef) {
    return {
      pdfBuffer: Buffer.alloc(0),
      filename: "",
      pageCount: 0,
      formType,
      fields,
      clauses: [],
      validation: { valid: false, errors: [`Unknown form type: ${formType}`], warnings: [] },
      timing: { parseMs, generateMs: 0, totalMs: Date.now() - totalStart },
    }
  }

  // Step 3: Resolve defaults
  fields = resolveDefaults(fields, formDef)

  // Step 4: Select clauses
  const clauseContext: ClauseContext = {
    financingType: fields.financing_type?.toLowerCase(),
    propertyType: fields.property_type?.toLowerCase(),
    yearBuilt: fields.year_built ? parseInt(fields.year_built) : undefined,
    floodZone: fields.flood_zone,
    hasHOA: fields.hoa === "true",
    earnestMoney: fields.earnest_money ? parseFloat(fields.earnest_money.replace(/[^0-9.]/g, "")) : undefined,
    purchasePrice: fields.purchase_price ? parseFloat(fields.purchase_price.replace(/[^0-9.]/g, "")) : undefined,
    closingDate: fields.closing_date,
    inspectionDays: fields.inspection_days ? parseInt(fields.inspection_days) : 14,
    appraisalDays: fields.appraisal_days ? parseInt(fields.appraisal_days) : 14,
    financingDays: fields.financing_days ? parseInt(fields.financing_days) : 25,
    servitudes: fields.servitudes,
    homeWarranty: fields.home_warranty === "true",
  }

  const selectedClauses = selectClauses(formDef.formId, clauseContext)

  // Add any manually requested clauses
  // (req.clauses would be IDs to include additionally)

  // Step 5: Validate
  const validation = validateContract(fields, formDef)

  // Step 6: Generate PDF
  const genStart = Date.now()
  const { buffer, pageCount } = await generateContractPDF(formDef, fields, selectedClauses)
  const generateMs = Date.now() - genStart

  const addr = fields.property_address || "Unknown"
  const filename = `${formDef.formNumber}_${addr.replace(/[^a-zA-Z0-9]/g, "_")}_DRAFT.pdf`

  return {
    pdfBuffer: buffer,
    filename,
    pageCount,
    formType: formDef.formId,
    fields,
    clauses: selectedClauses.map(c => c.id),
    validation,
    timing: { parseMs, generateMs, totalMs: Date.now() - totalStart },
  }
}
