// lib/airsign/seal-pdf.ts
// Burns signatures, initials, dates, and text onto a PDF.
// Uses pdf-lib to modify the original PDF in memory and return sealed bytes.

import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { createHash } from "crypto"

export interface SealField {
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"
  page: number        // 1-indexed
  xPercent: number    // 0-100
  yPercent: number    // 0-100
  widthPercent: number
  heightPercent: number
  value: string       // signature text, date string, typed text, or "true"/"false"
  imageDataUrl?: string // PNG data URL for signature/initials image
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
  // SHA-256 of the original source PDF — anchored on the audit certificate so
  // anyone can verify which original document was signed, independent of the
  // seal artifacts. This is the forensic integrity hash.
  const sourceHash = createHash("sha256").update(pdfBytes).digest("hex")

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
        if (field.imageDataUrl) {
          // Embed signature as PNG image
          try {
            const base64 = field.imageDataUrl.split(",")[1]
            const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const pngImage = await doc.embedPng(imageBytes)
            const aspectRatio = pngImage.width / pngImage.height
            let drawW = fieldW
            let drawH = fieldW / aspectRatio
            if (drawH > fieldH) {
              drawH = fieldH
              drawW = fieldH * aspectRatio
            }
            page.drawImage(pngImage, {
              x: x + (fieldW - drawW) / 2,
              y: y + (fieldH - drawH) / 2,
              width: drawW,
              height: drawH,
            })
          } catch {
            // Fallback to text if image fails
            const fontSize = Math.min(fieldH * 0.6, 24)
            page.drawText(field.value, { x: x + 4, y: y + fieldH * 0.3, size: fontSize, font: helveticaBold, color: rgb(0.05, 0.05, 0.2) })
          }
        } else {
          const fontSize = Math.min(fieldH * 0.6, 24)
          page.drawText(field.value, { x: x + 4, y: y + fieldH * 0.3, size: fontSize, font: helveticaBold, color: rgb(0.05, 0.05, 0.2) })
        }
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
        if (field.imageDataUrl) {
          try {
            const base64 = field.imageDataUrl.split(",")[1]
            const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const pngImage = await doc.embedPng(imageBytes)
            const aspectRatio = pngImage.width / pngImage.height
            let drawW = fieldW
            let drawH = fieldW / aspectRatio
            if (drawH > fieldH) { drawH = fieldH; drawW = fieldH * aspectRatio }
            page.drawImage(pngImage, { x: x + (fieldW - drawW) / 2, y: y + (fieldH - drawH) / 2, width: drawW, height: drawH })
          } catch {
            const fontSize = Math.min(fieldH * 0.6, 18)
            page.drawText(field.value, { x: x + 2, y: y + fieldH * 0.25, size: fontSize, font: helveticaBold, color: rgb(0.05, 0.05, 0.2) })
          }
        } else {
          const fontSize = Math.min(fieldH * 0.6, 18)
          page.drawText(field.value, { x: x + 2, y: y + fieldH * 0.25, size: fontSize, font: helveticaBold, color: rgb(0.05, 0.05, 0.2) })
        }
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
          page.drawText("X", {
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

  // ─── AUDIT CERTIFICATE PAGE ──────────────────────────────────────────────

  const auditPage = doc.addPage([612, 792]) // US Letter
  const sage = rgb(0.604, 0.671, 0.494) // #9aab7e
  const olive = rgb(0.42, 0.49, 0.32)   // #6b7d52
  const forest = rgb(0.118, 0.141, 0.086) // #1e2416

  // Header bar
  auditPage.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: sage })
  auditPage.drawText("AirSign — Certificate of Completion", {
    x: 50, y: 758, size: 18, font: helveticaBold, color: rgb(0.96, 0.95, 0.92),
  })

  let auditY = 720

  // Document info section
  auditPage.drawText("DOCUMENT", { x: 50, y: auditY, size: 8, font: helveticaBold, color: olive })
  auditY -= 16
  auditPage.drawText(envelopeName, { x: 50, y: auditY, size: 12, font: helveticaBold, color: forest })
  auditY -= 18

  const sealTimestamp = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  })
  auditPage.drawText(`Sealed: ${sealTimestamp}`, { x: 50, y: auditY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) })
  auditY -= 14
  auditPage.drawText(`Fields sealed: ${fields.filter(f => f.value).length}`, { x: 50, y: auditY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) })
  auditY -= 14

  // Unique seal ID
  const sealId = `AIRE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  auditPage.drawText(`Seal ID: ${sealId}`, { x: 50, y: auditY, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) })
  auditY -= 14

  // Source document SHA-256 — split across 2 lines because 64 hex chars is wide
  auditPage.drawText("Source Document SHA-256:", { x: 50, y: auditY, size: 8, font: helveticaBold, color: olive })
  auditY -= 12
  auditPage.drawText(sourceHash.slice(0, 32), { x: 50, y: auditY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) })
  auditY -= 11
  auditPage.drawText(sourceHash.slice(32), { x: 50, y: auditY, size: 8, font: helvetica, color: rgb(0.3, 0.3, 0.3) })
  auditY -= 20

  // Divider
  auditPage.drawLine({ start: { x: 50, y: auditY }, end: { x: 562, y: auditY }, thickness: 0.5, color: sage })
  auditY -= 24

  // Signers section
  const uniqueSigners = [...new Set(auditEntries.filter(e => e.action === "signed").map(e => e.signerName))]
  if (uniqueSigners.length > 0) {
    auditPage.drawText("SIGNERS", { x: 50, y: auditY, size: 8, font: helveticaBold, color: olive })
    auditY -= 18
    for (const signer of uniqueSigners) {
      const entry = auditEntries.find(e => e.signerName === signer && e.action === "signed")
      auditPage.drawText(`X  ${signer}`, { x: 56, y: auditY, size: 10, font: helveticaBold, color: forest })
      if (entry) {
        auditPage.drawText(`Signed: ${entry.timestamp}${entry.ipAddress ? `  •  IP: ${entry.ipAddress}` : ""}`, {
          x: 70, y: auditY - 12, size: 8, font: helvetica, color: rgb(0.4, 0.4, 0.4),
        })
        auditY -= 30
      } else {
        auditY -= 18
      }
    }
    auditY -= 10
  }

  // Divider
  auditPage.drawLine({ start: { x: 50, y: auditY }, end: { x: 562, y: auditY }, thickness: 0.5, color: sage })
  auditY -= 24

  // Full audit trail
  auditPage.drawText("AUDIT TRAIL", { x: 50, y: auditY, size: 8, font: helveticaBold, color: olive })
  auditY -= 18

  for (const entry of auditEntries) {
    if (auditY < 60) break
    const line = `${entry.timestamp}  •  ${entry.signerName}  •  ${entry.action}${entry.ipAddress ? `  •  IP: ${entry.ipAddress}` : ""}`
    auditPage.drawText(line, { x: 50, y: auditY, size: 7.5, font: helvetica, color: rgb(0.25, 0.25, 0.25) })
    auditY -= 13
  }

  // Footer
  auditPage.drawLine({ start: { x: 50, y: 50 }, end: { x: 562, y: 50 }, thickness: 0.5, color: sage })
  auditPage.drawText("This document was electronically signed and sealed using AirSign by AIRE Intelligence.", {
    x: 50, y: 38, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5),
  })
  auditPage.drawText("Baton Rouge, Louisiana  •  aireintel.org  •  Patent Pending", {
    x: 50, y: 28, size: 7, font: helvetica, color: rgb(0.5, 0.5, 0.5),
  })

  return doc.save()
}
