import * as pdfParse from 'pdf-parse'
import { getFile } from './storage'

export async function extractPDFText(fileKey: string): Promise<string> {
  const buffer = await getFile(fileKey)
  const data = await (pdfParse as any).default(buffer)
  return data.text
}

export function classifyLRECForm(text: string): string | null {
  if (text.includes('LREC Form 101') || text.includes('RESIDENTIAL PURCHASE AGREEMENT')) {
    return 'LREC_101_PURCHASE'
  }
  if (text.includes('LREC Form 102') || text.includes('COUNTER OFFER')) {
    return 'LREC_102_COUNTER'
  }
  if (text.includes('LREC Form 103') || text.includes('ADDENDUM')) {
    return 'LREC_103_ADDENDUM'
  }
  if (text.includes('PROPERTY DISCLOSURE')) {
    return 'DISCLOSURE'
  }
  if (text.includes('INSPECTION REPORT')) {
    return 'INSPECTION'
  }
  return null
}
