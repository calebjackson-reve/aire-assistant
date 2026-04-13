import prisma from "@/lib/prisma"
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib"
import { createHash } from "node:crypto"
import { resolveBrokerageSettings } from "./brokerage"

/**
 * Certificate of Completion — branded, legally-grounded PDF with the full audit trail.
 * Built with pdf-lib (already used by seal-pdf.ts). Supports brokerage branding override.
 *
 * Usage:
 *   const pdfBytes = await buildCertificate(envelopeId)
 *   return new NextResponse(pdfBytes, { headers: { "Content-Type": "application/pdf" } })
 */

const SAGE = rgb(0x9a / 255, 0xab / 255, 0x7e / 255)
const OLIVE = rgb(0x6b / 255, 0x7d / 255, 0x52 / 255)
const DEEP_FOREST = rgb(0x1e / 255, 0x24 / 255, 0x16 / 255)
const MUTED = rgb(0x8a / 255, 0x90 / 255, 0x70 / 255)

export async function buildCertificate(envelopeId: string): Promise<Uint8Array> {
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    include: {
      signers: {
        include: { auditEvents: { orderBy: { createdAt: "asc" } } },
        orderBy: { signingOrder: "asc" },
      },
      auditEvents: { orderBy: { createdAt: "asc" } },
      fields: true,
      brokerage: true,
    },
  })
  if (!envelope) throw new Error("Envelope not found")

  const settings = envelope.brokerageId ? await resolveBrokerageSettings(envelope.brokerageId) : null
  const accentHex = settings?.branding.accentColor
  const accent = accentHex ? hexToRgb(accentHex) : OLIVE

  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const mono = await pdf.embedFont(StandardFonts.Courier)
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold)

  let page = pdf.addPage([612, 792])
  const left = 54
  let y = 740

  if (envelope.brokerage) {
    page.drawRectangle({ x: 0, y: 770, width: 612, height: 22, color: accent })
    page.drawText(envelope.brokerage.name, { x: left, y: 776, size: 11, font: helvBold, color: rgb(1, 1, 1) })
    y = 740
  }

  page.drawText("Certificate of Completion", { x: left, y, size: 22, font: helvBold, color: DEEP_FOREST })
  y -= 28

  page.drawText(envelope.name, { x: left, y, size: 12, font: helv, color: DEEP_FOREST })
  y -= 8
  page.drawLine({ start: { x: left, y }, end: { x: 558, y }, thickness: 1, color: SAGE })
  y -= 18

  const metaRows: Array<[string, string]> = [
    ["Envelope ID", envelope.id],
    ["Status", envelope.status],
    ["Created", envelope.createdAt.toISOString()],
    ["Sent", envelope.sentAt?.toISOString() ?? "—"],
    ["Completed", envelope.completedAt?.toISOString() ?? "—"],
    ["Total pages", String(envelope.pageCount ?? 0)],
    ["Total fields", String(envelope.fields.length)],
  ]
  for (const [k, v] of metaRows) {
    page.drawText(k.toUpperCase(), { x: left, y, size: 8, font: helvBold, color: MUTED })
    page.drawText(v, { x: left + 110, y, size: 9, font: mono, color: DEEP_FOREST })
    y -= 13
  }
  y -= 10

  page.drawText("Signers", { x: left, y, size: 13, font: helvBold, color: DEEP_FOREST })
  y -= 6
  page.drawLine({ start: { x: left, y }, end: { x: 558, y }, thickness: 0.5, color: SAGE })
  y -= 14

  for (const signer of envelope.signers) {
    if (y < 180) {
      page = pdf.addPage([612, 792])
      y = 740
    }
    page.drawText(signer.name, { x: left, y, size: 10, font: helvBold, color: DEEP_FOREST })
    page.drawText(signer.email, { x: left + 180, y, size: 9, font: helv, color: DEEP_FOREST })
    page.drawText(signer.authMethod, { x: 440, y, size: 8, font: monoBold, color: accent })
    y -= 11
    const evidenceRows: Array<[string, string]> = [
      ["role", signer.role],
      ["permission", signer.permission],
      ["viewed at", signer.viewedAt?.toISOString() ?? "—"],
      ["signed at", signer.signedAt?.toISOString() ?? "—"],
      ["declined at", signer.declinedAt?.toISOString() ?? "—"],
      ["ip address", signer.ipAddress ?? "—"],
      ["user agent", (signer.userAgent ?? "—").slice(0, 80)],
      ["auth verified", signer.authVerifiedAt?.toISOString() ?? "—"],
    ]
    for (const [k, v] of evidenceRows) {
      if (y < 80) {
        page = pdf.addPage([612, 792])
        y = 740
      }
      page.drawText(k, { x: left + 12, y, size: 7, font: helvBold, color: MUTED })
      page.drawText(v, { x: left + 100, y, size: 7, font: mono, color: DEEP_FOREST })
      y -= 9
    }
    y -= 6
  }

  await drawLegalPage(pdf, helv, helvBold, mono, envelope.documentUrl)

  return pdf.save()
}

async function drawLegalPage(
  pdf: PDFDocument,
  helv: PDFFont,
  helvBold: PDFFont,
  mono: PDFFont,
  documentUrl: string | null
) {
  const page = pdf.addPage([612, 792])
  const left = 54
  let y = 740
  page.drawText("Legal Disclosures & Consent", { x: left, y, size: 16, font: helvBold, color: DEEP_FOREST })
  y -= 24

  const blocks: Array<[string, string]> = [
    [
      "U.S. E-SIGN Act (15 U.S.C. Ch. 96)",
      "Each signer consented to conduct business electronically. Their signature is legally binding under the " +
        "Electronic Signatures in Global and National Commerce Act. Signer was offered the option to receive a " +
        "paper copy and declined by proceeding with electronic signing.",
    ],
    [
      "Uniform Electronic Transactions Act (UETA)",
      "This transaction occurred in a jurisdiction that has adopted the Uniform Electronic Transactions Act. " +
        "Signers consented to use electronic records and signatures for this transaction.",
    ],
    [
      "eIDAS (EU Regulation 910/2014)",
      "For signers located in the EU, this signature constitutes an 'Advanced Electronic Signature' when combined " +
        "with the signer authentication method recorded above.",
    ],
    ["Hash of original document", "SHA-256: " + (await sha256OfEnvelopeDoc(documentUrl))],
  ]
  for (const [title, body] of blocks) {
    page.drawText(title, { x: left, y, size: 10, font: helvBold, color: OLIVE })
    y -= 14
    for (const line of wrapText(body, 85)) {
      page.drawText(line, { x: left, y, size: 8.5, font: helv, color: DEEP_FOREST })
      y -= 11
    }
    y -= 8
  }

  page.drawText(`Generated ${new Date().toISOString()} by AIRESIGN`, {
    x: left,
    y: 40,
    size: 7,
    font: mono,
    color: MUTED,
  })
}

async function sha256OfEnvelopeDoc(url: string | null | undefined): Promise<string> {
  if (!url) return "—"
  try {
    const res = await fetch(url)
    if (!res.ok) return "—"
    const buf = await res.arrayBuffer()
    return createHash("sha256").update(Buffer.from(buf)).digest("hex")
  } catch {
    return "—"
  }
}

function wrapText(text: string, charsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if ((cur + " " + w).trim().length > charsPerLine) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = (cur + " " + w).trim()
    }
  }
  if (cur) lines.push(cur)
  return lines
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "")
  if (clean.length !== 6) return OLIVE
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  if ([r, g, b].some((c) => isNaN(c))) return OLIVE
  return rgb(r, g, b)
}
// Keep drawPage prop for future per-page hooks
export const __PDFPage: undefined | PDFPage = undefined
