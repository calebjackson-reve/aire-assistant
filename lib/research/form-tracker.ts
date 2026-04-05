/**
 * AIRE Form Tracker — LREC Form Version Detection
 * Compares uploaded documents against known LREC form structures.
 * Detects when forms change (new fields, layout shifts).
 * Alerts when extraction rules may be outdated.
 */

import prisma from '@/lib/prisma'

interface FormSignature {
  formType: string
  formNumber: string
  version: string
  pageCount: number
  knownFields: string[]
  headerPattern: string
  lastSeen: Date
}

/**
 * Known LREC form signatures (2026 edition).
 * Used to detect version changes in uploaded forms.
 */
const KNOWN_FORMS: FormSignature[] = [
  {
    formType: 'purchase_agreement',
    formNumber: 'LREC-101',
    version: '2026-01',
    pageCount: 12,
    knownFields: [
      'BUYER', 'SELLER', 'PROPERTY ADDRESS', 'PARISH', 'PURCHASE PRICE',
      'EARNEST MONEY', 'CLOSING DATE', 'INSPECTION PERIOD', 'FINANCING',
      'MINERAL RIGHTS', 'FLOOD ZONE', 'TERMITE INSPECTION', 'MLS NUMBER'
    ],
    headerPattern: 'RESIDENTIAL AGREEMENT TO BUY OR SELL',
    lastSeen: new Date('2026-01-01')
  },
  {
    formType: 'property_disclosure',
    formNumber: 'LREC-PDD',
    version: '2026-01',
    pageCount: 5,
    knownFields: [
      'PROPERTY ADDRESS', 'SELLER NAME', 'ROOF', 'FOUNDATION',
      'PLUMBING', 'ELECTRICAL', 'HVAC', 'WATER HEATER',
      'KNOWN DEFECTS', 'FLOOD HISTORY', 'TERMITE HISTORY'
    ],
    headerPattern: 'PROPERTY DISCLOSURE DOCUMENT',
    lastSeen: new Date('2026-01-01')
  },
  {
    formType: 'agency_disclosure',
    formNumber: 'LREC-AD',
    version: '2026-01',
    pageCount: 2,
    knownFields: [
      'AGENT NAME', 'BROKER NAME', 'REPRESENTATION TYPE', 'CLIENT NAME'
    ],
    headerPattern: 'AGENCY DISCLOSURE',
    lastSeen: new Date('2026-01-01')
  },
  {
    formType: 'counter_offer',
    formNumber: 'LREC-102',
    version: '2026-01',
    pageCount: 2,
    knownFields: [
      'ORIGINAL CONTRACT DATE', 'PROPERTY ADDRESS', 'COUNTER TERMS',
      'RESPONSE DEADLINE', 'BUYER', 'SELLER'
    ],
    headerPattern: 'COUNTER OFFER',
    lastSeen: new Date('2026-01-01')
  },
  {
    formType: 'amendment',
    formNumber: 'LREC-103',
    version: '2026-01',
    pageCount: 2,
    knownFields: [
      'ORIGINAL CONTRACT DATE', 'PROPERTY ADDRESS', 'AMENDMENT TERMS',
      'EFFECTIVE DATE', 'BUYER', 'SELLER'
    ],
    headerPattern: 'AMENDMENT',
    lastSeen: new Date('2026-01-01')
  }
]

interface FormComparisonResult {
  formType: string
  matchedVersion: string | null
  isKnownForm: boolean
  pageCountMatch: boolean
  fieldsMatched: string[]
  fieldsMissing: string[]
  newFieldsDetected: string[]
  versionChangeDetected: boolean
  alert: string | null
}

/**
 * Compare an uploaded document's structure against known LREC form signatures.
 */
export function compareToKnownForm(
  detectedType: string,
  pageCount: number,
  extractedFieldNames: string[],
  headerText: string
): FormComparisonResult {
  const upperFields = extractedFieldNames.map(f => f.toUpperCase().replace(/_/g, ' '))
  const upperHeader = headerText.toUpperCase()

  // Find matching known form
  const knownForm = KNOWN_FORMS.find(f =>
    f.formType === detectedType ||
    upperHeader.includes(f.headerPattern)
  )

  if (!knownForm) {
    return {
      formType: detectedType,
      matchedVersion: null,
      isKnownForm: false,
      pageCountMatch: false,
      fieldsMatched: [],
      fieldsMissing: [],
      newFieldsDetected: extractedFieldNames,
      versionChangeDetected: false,
      alert: `Unknown form type: ${detectedType}. Consider adding to form tracker.`
    }
  }

  const fieldsMatched = knownForm.knownFields.filter(f =>
    upperFields.some(uf => uf.includes(f) || f.includes(uf))
  )
  const fieldsMissing = knownForm.knownFields.filter(f =>
    !upperFields.some(uf => uf.includes(f) || f.includes(uf))
  )
  const newFieldsDetected = upperFields.filter(uf =>
    !knownForm.knownFields.some(f => uf.includes(f) || f.includes(uf))
  )

  const pageCountMatch = Math.abs(pageCount - knownForm.pageCount) <= 1
  const versionChangeDetected = !pageCountMatch || newFieldsDetected.length > 2 || fieldsMissing.length > 3

  let alert: string | null = null
  if (versionChangeDetected) {
    alert = `POSSIBLE FORM VERSION CHANGE: ${knownForm.formNumber} (${knownForm.version}). ` +
      `Page count: expected ${knownForm.pageCount}, got ${pageCount}. ` +
      `${newFieldsDetected.length} new fields, ${fieldsMissing.length} missing fields. ` +
      `Extraction rules may need updating.`
  }

  return {
    formType: detectedType,
    matchedVersion: knownForm.version,
    isKnownForm: true,
    pageCountMatch,
    fieldsMatched,
    fieldsMissing,
    newFieldsDetected,
    versionChangeDetected,
    alert
  }
}

/**
 * Get form tracking summary across all processed documents.
 */
export async function getFormTrackingSummary(): Promise<{
  knownForms: number
  formTypes: { type: string; formNumber: string; version: string; lastSeen: string }[]
  versionAlerts: string[]
}> {
  // Check recent documents for version change alerts
  const recentDocs = await (prisma.document as any).findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    select: { type: true, metadata: true },
    take: 100,
    orderBy: { createdAt: 'desc' }
  })

  const versionAlerts: string[] = []
  for (const doc of recentDocs) {
    const meta = doc.metadata as Record<string, unknown> | null
    const formCheck = meta?.formComparison as FormComparisonResult | undefined
    if (formCheck?.alert) {
      versionAlerts.push(formCheck.alert)
    }
  }

  return {
    knownForms: KNOWN_FORMS.length,
    formTypes: KNOWN_FORMS.map(f => ({
      type: f.formType,
      formNumber: f.formNumber,
      version: f.version,
      lastSeen: f.lastSeen.toISOString()
    })),
    versionAlerts: [...new Set(versionAlerts)] // deduplicate
  }
}
