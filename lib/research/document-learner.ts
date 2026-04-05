/**
 * AIRE Document Learner — Extraction Quality Tracking
 * Logs extraction quality after every document upload.
 * Flags low-confidence results for review.
 * Tracks per-form-type accuracy over time.
 */

import prisma from '@/lib/prisma'

const LOW_CONFIDENCE_THRESHOLD = 0.7

interface ExtractionResult {
  documentId: string
  transactionId?: string
  userId: string
  formType: string
  formNumber?: string
  extractionMethod: 'acroform' | 'text_stream' | 'claude_vision' | 'multi_pass'
  fieldsExpected: string[]
  fieldsFound: Record<string, unknown>
  confidence: number
  processingTimeMs: number
  pageCount: number
}

interface ExtractionQualityLog {
  documentId: string
  formType: string
  fieldsExpected: number
  fieldsFound: number
  fieldsMissed: string[]
  confidence: number
  extractionMethod: string
  processingTimeMs: number
  flaggedForReview: boolean
  createdAt: Date
}

/**
 * Expected fields per LREC form type.
 * Used to calculate extraction completeness.
 */
const EXPECTED_FIELDS: Record<string, string[]> = {
  purchase_agreement: [
    'buyerName', 'sellerName', 'propertyAddress', 'parish',
    'purchasePrice', 'earnestMoney', 'closingDate', 'inspectionDeadline',
    'financingType', 'mlsNumber', 'listingAgent', 'sellingAgent',
    'legalDescription', 'lotNumber', 'subdivision'
  ],
  property_disclosure: [
    'propertyAddress', 'sellerName', 'roofAge', 'foundationType',
    'knownDefects', 'floodZone', 'previousFlooding', 'termiteHistory',
    'hvacAge', 'waterHeaterAge', 'electricalType', 'plumbingType'
  ],
  agency_disclosure: [
    'agentName', 'brokerName', 'representationType', 'clientName'
  ],
  addendum: [
    'referenceContract', 'addendumType', 'effectiveDate', 'parties'
  ],
  inspection_report: [
    'inspectorName', 'inspectionDate', 'propertyAddress',
    'majorFindings', 'minorFindings', 'recommendations'
  ],
  closing_disclosure: [
    'closingDate', 'purchasePrice', 'loanAmount', 'interestRate',
    'monthlyPayment', 'closingCosts', 'cashToClose'
  ]
}

/**
 * Log extraction quality after processing a document.
 * Calculates completeness, flags low-confidence results.
 */
export async function logExtractionQuality(result: ExtractionResult): Promise<ExtractionQualityLog> {
  const expectedFields = EXPECTED_FIELDS[result.formType] || result.fieldsExpected
  const foundFieldNames = Object.keys(result.fieldsFound).filter(
    k => result.fieldsFound[k] !== null && result.fieldsFound[k] !== undefined && result.fieldsFound[k] !== ''
  )

  const fieldsMissed = expectedFields.filter(f => !foundFieldNames.includes(f))
  const flaggedForReview = result.confidence < LOW_CONFIDENCE_THRESHOLD || fieldsMissed.length > expectedFields.length * 0.3

  const log: ExtractionQualityLog = {
    documentId: result.documentId,
    formType: result.formType,
    fieldsExpected: expectedFields.length,
    fieldsFound: foundFieldNames.length,
    fieldsMissed,
    confidence: result.confidence,
    extractionMethod: result.extractionMethod,
    processingTimeMs: result.processingTimeMs,
    flaggedForReview,
    createdAt: new Date()
  }

  // Store in DB via JSON field on the Document model
  try {
    await (prisma.document as any).update({
      where: { id: result.documentId },
      data: {
        metadata: JSON.parse(JSON.stringify({
          extractionQuality: {
            fieldsExpected: log.fieldsExpected,
            fieldsFound: log.fieldsFound,
            fieldsMissed: log.fieldsMissed,
            confidence: log.confidence,
            extractionMethod: log.extractionMethod,
            processingTimeMs: log.processingTimeMs,
            flaggedForReview: log.flaggedForReview,
            loggedAt: log.createdAt.toISOString()
          }
        }))
      }
    })
  } catch (err) {
    console.error('[document-learner] Failed to log extraction quality:', err)
  }

  if (flaggedForReview) {
    console.warn(
      `[document-learner] LOW CONFIDENCE: ${result.formType} (${(result.confidence * 100).toFixed(1)}%) — ` +
      `${fieldsMissed.length}/${expectedFields.length} fields missed: ${fieldsMissed.join(', ')}`
    )
  }

  return log
}

/**
 * Get extraction accuracy stats grouped by form type.
 */
export async function getExtractionStats(): Promise<{
  totalProcessed: number
  flaggedForReview: number
  averageConfidence: number
  byFormType: Record<string, {
    count: number
    avgConfidence: number
    avgFieldsFound: number
    avgFieldsExpected: number
    completionRate: number
    topMissedFields: string[]
  }>
}> {
  const documents = await (prisma.document as any).findMany({
    where: {
      metadata: { not: undefined }
    },
    select: {
      type: true,
      metadata: true
    }
  })

  const stats: Record<string, {
    count: number
    totalConfidence: number
    totalFieldsFound: number
    totalFieldsExpected: number
    flagged: number
    missedFields: Record<string, number>
  }> = {}

  let totalProcessed = 0
  let totalFlagged = 0
  let totalConfidence = 0

  for (const doc of documents) {
    const meta = doc.metadata as Record<string, unknown> | null
    const eq = meta?.extractionQuality as Record<string, unknown> | undefined
    if (!eq) continue

    totalProcessed++
    const confidence = (eq.confidence as number) || 0
    totalConfidence += confidence
    if (eq.flaggedForReview) totalFlagged++

    const formType = doc.type || 'unknown'
    if (!stats[formType]) {
      stats[formType] = { count: 0, totalConfidence: 0, totalFieldsFound: 0, totalFieldsExpected: 0, flagged: 0, missedFields: {} }
    }

    const s = stats[formType]
    s.count++
    s.totalConfidence += confidence
    s.totalFieldsFound += (eq.fieldsFound as number) || 0
    s.totalFieldsExpected += (eq.fieldsExpected as number) || 0
    if (eq.flaggedForReview) s.flagged++

    const missed = (eq.fieldsMissed as string[]) || []
    for (const field of missed) {
      s.missedFields[field] = (s.missedFields[field] || 0) + 1
    }
  }

  const byFormType: Record<string, {
    count: number
    avgConfidence: number
    avgFieldsFound: number
    avgFieldsExpected: number
    completionRate: number
    topMissedFields: string[]
  }> = {}

  for (const [formType, s] of Object.entries(stats)) {
    const topMissed = Object.entries(s.missedFields)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([field, count]) => `${field} (${((count / s.count) * 100).toFixed(0)}% miss rate)`)

    byFormType[formType] = {
      count: s.count,
      avgConfidence: s.count > 0 ? s.totalConfidence / s.count : 0,
      avgFieldsFound: s.count > 0 ? s.totalFieldsFound / s.count : 0,
      avgFieldsExpected: s.count > 0 ? s.totalFieldsExpected / s.count : 0,
      completionRate: s.totalFieldsExpected > 0 ? s.totalFieldsFound / s.totalFieldsExpected : 0,
      topMissedFields: topMissed
    }
  }

  return {
    totalProcessed,
    flaggedForReview: totalFlagged,
    averageConfidence: totalProcessed > 0 ? totalConfidence / totalProcessed : 0,
    byFormType
  }
}
