// lib/airsign/seal-pdf.ts
// Burns signatures, initials, dates, and text onto a PDF.
// Uses pdf-lib to modify the original PDF in memory and return sealed bytes.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

export interface SealField {
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"
  page: number        // 1-indexed
  xPercent: number    // 0-100
  yPercent: number    // 0-100
  widthPercent: number
  heightPercent: number
  value: string       // signature text, date string, typed text, or "true"/"false"
  signerName?: string
}

export interface AuditEntry {
  action: string
  signerName: string
  timestamp: string
  ipAddress?: string
}

/**
 * Seal a PDF by burning field values onto it and appending an audit page.
 */
export async function sealPdf(
  pdfBytes: Uint8Array,
  fields: SealField[],
  auditEntries: AuditEntry[],
  envelopeName: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const helvetica = await doc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages = doc.getPages()

  for (const field of fields) {
    if (!field.value) continue
    const pageIndex = field.page - 1
    if (pageIndex < 0 || pageIndex >= pages.length) continue

    const page = pages[pageIndex]
    const { width: pageW, height: pageH } = page.getSize()

    const x = (field.xPercent / 100) * pageW
    // PDF coordinates are bottom-up, percentage is top-down
    const fieldH = (field.heightPercent / 100) * pageH
    const y = pageH - (field.yPercent / 100) * pageH - fieldH
    const fieldW = (field.widthPercent / 100) * pageW

    switch (field.type) {
      case "SIGNATURE": {
        // Draw signature as styled italic text with underline
        const fontSize = Math.min(fieldH * 0.6, 24)
        page.drawText(field.value, {
          x: x + 4,
          y: y + fieldH * 0.3,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0.05, 0.05, 0.2),
        })
        // Underline
        page.drawLine({
          start: { x, y: y + 2 },
          end: { x: x + fieldW, y: y + 2 },
          thickness: 0.5,
          color: rgb(0.3, 0.3, 0.3),
        })
        break
      }
      case "INITIALS": {
        const fontSize = Math.min(fieldH * 0.6, 18)
        page.drawText(field.value, {
          x: x + 2,
          y: y + fieldH * 0.25,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0.05, 0.05, 0.2),
        })
        break
      }
      case "DATE": {
        const fontSize = Math.min(fieldH * 0.55, 12)
        page.drawText(field.value, {
          x: x + 2,
          y: y + fieldH * 0.3,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        })
        break
      }
      case "TEXT": {
        const fontSize = Math.min(fieldH * 0.55, 12)
        page.drawText(field.value, {
          x: x + 2,
          y: y + fieldH * 0.3,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        })
        break
      }
      case "CHECKBOX": {
        if (field.value === "true") {
          const size = Math.min(fieldW, fieldH) * 0.7
          const cx = x + fieldW / 2
          const cy = y + fieldH / 2
          page.drawText("✓", {
            x: cx - size / 2,
            y: cy - size / 2,
            size,
            font: helvetica,
            color: rgb(0, 0, 0),
          })
        }
        break
      }
    }
  }

  // Append audit certificate page
  const auditPage = doc.addPage([612, 792]) // US Letter
  let auditY = 740

  auditPage.drawText("AirSign — Certificate of Completion", {
    x: 50,
    y: auditY,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.14, 0.09), // deep forest
  })
  auditY -= 30

  auditPage.drawText(`Document: ${envelopeName}`, {
    x: 50,
    y: auditY,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  })
  auditY -= 15

  auditPage.drawText(`Sealed: ${new Date().toISOString()}`, {
    x: 50,
    y: auditY,
    size: 10,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  })
  auditY -= 30

  // Divider
  auditPage.drawLine({
    start: { x: 50, y: auditY },
    end: { x: 562, y: auditY },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })
  auditY -= 20

  auditPage.drawText("Audit Trail", {
    x: 50,
    y: auditY,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  })
  auditY -= 20

  for (const entry of auditEntries) {
    if (auditY < 60) break
    const line = `${entry.timestamp}  |  ${entry.signerName}  |  ${entry.action}${entry.ipAddress ? `  |  IP: ${entry.ipAddress}` : ""}`
    auditPage.drawText(line, {
      x: 50,
      y: auditY,
      size: 8,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
    })
    auditY -= 14
  }

  // Footer
  auditPage.drawText("Powered by AIRE Intelligence — AirSign Electronic Signatures", {
    x: 50,
    y: 30,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  })

  return doc.save()
}
