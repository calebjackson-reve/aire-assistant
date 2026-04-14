import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createTemplate, type TemplateFieldSpec } from "@/lib/airsign/v2/templates"

/**
 * Seed 3 curated LREC templates for the current user.
 *
 * Creates PERSONAL templates (not MARKETPLACE) so a single user seed doesn't
 * pollute the global library. DOCUMENT kind with default field layouts that
 * match the Louisiana Real Estate Commission standard forms:
 *   - LREC-RPA (Residential Purchase Agreement, 12pg)
 *   - LREC-SPD (Seller Property Disclosure, 4pg)
 *   - LREC-ELA (Exclusive Listing Agreement, 6pg)
 *
 * pdfBlobUrl is left null; users upload the actual LREC PDF via the
 * template detail page. The seed gives them the field layout + signer
 * role structure to start from.
 */
export async function POST() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Idempotent: skip if this user already has these templates
  const existing = await prisma.airSignTemplate.findMany({
    where: {
      userId: user.id,
      scope: "PERSONAL",
      formCode: { in: ["LREC-RPA", "LREC-SPD", "LREC-ELA"] },
    },
    select: { formCode: true },
  })
  const existingCodes = new Set(existing.map((t: { formCode: string | null }) => t.formCode))

  const seeded: Array<{ id: string; name: string; formCode: string }> = []

  const specs: Array<{
    formCode: string
    name: string
    description: string
    folder: string
    pageCount: number
    fieldLayout: TemplateFieldSpec[]
  }> = [
    {
      formCode: "LREC-RPA",
      name: "Residential Purchase Agreement",
      description: "LREC standard purchase agreement — 12 pages, parties, financing, closing.",
      folder: "Purchase & Sale",
      pageCount: 12,
      fieldLayout: buildPurchaseAgreementLayout(),
    },
    {
      formCode: "LREC-SPD",
      name: "Seller Property Disclosure",
      description: "Louisiana seller's disclosure of property condition — 4 pages.",
      folder: "Disclosures & Compliance",
      pageCount: 4,
      fieldLayout: buildSellerDisclosureLayout(),
    },
    {
      formCode: "LREC-ELA",
      name: "Exclusive Listing Agreement",
      description: "Exclusive right-to-sell listing contract — 6 pages.",
      folder: "Listing & Agency",
      pageCount: 6,
      fieldLayout: buildListingAgreementLayout(),
    },
  ]

  for (const s of specs) {
    if (existingCodes.has(s.formCode)) continue
    try {
      const t = await createTemplate(user.id, {
        scope: "PERSONAL",
        kind: "DOCUMENT",
        name: s.name,
        description: s.description,
        folder: s.folder,
        formCode: s.formCode,
        pageCount: s.pageCount,
        fieldLayout: s.fieldLayout,
        tags: ["lrec", "louisiana"],
      })
      seeded.push({ id: t.id, name: t.name, formCode: s.formCode })
    } catch (err) {
      console.error(`[LREC seed] Failed to seed ${s.formCode}:`, err)
    }
  }

  return NextResponse.json({
    seeded,
    skipped: Array.from(existingCodes),
    total: specs.length,
  })
}

// ─── Field Layout Builders ─────────────────────────────────────────────
// All coordinates are percentages of the page size. Whole numbers only.

function buildPurchaseAgreementLayout(): TemplateFieldSpec[] {
  // 12-page PA — initials on every page, signatures on pg 12
  const layout: TemplateFieldSpec[] = []
  for (let page = 0; page < 11; page++) {
    layout.push({
      type: "INITIALS",
      page,
      xPct: 10,
      yPct: 93,
      wPct: 8,
      hPct: 3,
      signerRole: "BUYER",
      required: true,
    })
    layout.push({
      type: "INITIALS",
      page,
      xPct: 55,
      yPct: 93,
      wPct: 8,
      hPct: 3,
      signerRole: "SELLER",
      required: true,
    })
  }
  // Final signatures + dates on page 11 (0-indexed pg 12)
  layout.push(
    { type: "SIGNATURE", page: 11, xPct: 5, yPct: 70, wPct: 30, hPct: 5, signerRole: "BUYER", required: true },
    { type: "DATE", page: 11, xPct: 37, yPct: 70, wPct: 12, hPct: 3, signerRole: "BUYER", required: true },
    { type: "SIGNATURE", page: 11, xPct: 52, yPct: 70, wPct: 30, hPct: 5, signerRole: "SELLER", required: true },
    { type: "DATE", page: 11, xPct: 84, yPct: 70, wPct: 12, hPct: 3, signerRole: "SELLER", required: true },
  )
  return layout
}

function buildSellerDisclosureLayout(): TemplateFieldSpec[] {
  // 4-page SPD — initials pg 1-3, signature pg 4
  const layout: TemplateFieldSpec[] = []
  for (let page = 0; page < 3; page++) {
    layout.push({
      type: "INITIALS",
      page,
      xPct: 55,
      yPct: 93,
      wPct: 8,
      hPct: 3,
      signerRole: "SELLER",
      required: true,
    })
  }
  layout.push(
    { type: "SIGNATURE", page: 3, xPct: 5, yPct: 75, wPct: 35, hPct: 5, signerRole: "SELLER", required: true },
    { type: "DATE", page: 3, xPct: 42, yPct: 75, wPct: 12, hPct: 3, signerRole: "SELLER", required: true },
    // Buyer acknowledgment at bottom
    { type: "SIGNATURE", page: 3, xPct: 5, yPct: 85, wPct: 35, hPct: 5, signerRole: "BUYER", required: false },
    { type: "DATE", page: 3, xPct: 42, yPct: 85, wPct: 12, hPct: 3, signerRole: "BUYER", required: false },
  )
  return layout
}

function buildListingAgreementLayout(): TemplateFieldSpec[] {
  // 6-page ELA — initials pg 1-5, signatures pg 6
  const layout: TemplateFieldSpec[] = []
  for (let page = 0; page < 5; page++) {
    layout.push({
      type: "INITIALS",
      page,
      xPct: 55,
      yPct: 93,
      wPct: 8,
      hPct: 3,
      signerRole: "SELLER",
      required: true,
    })
    layout.push({
      type: "INITIALS",
      page,
      xPct: 75,
      yPct: 93,
      wPct: 8,
      hPct: 3,
      signerRole: "AGENT",
      required: true,
    })
  }
  layout.push(
    { type: "SIGNATURE", page: 5, xPct: 5, yPct: 70, wPct: 30, hPct: 5, signerRole: "SELLER", required: true },
    { type: "DATE", page: 5, xPct: 37, yPct: 70, wPct: 12, hPct: 3, signerRole: "SELLER", required: true },
    { type: "SIGNATURE", page: 5, xPct: 52, yPct: 70, wPct: 30, hPct: 5, signerRole: "AGENT", required: true },
    { type: "DATE", page: 5, xPct: 84, yPct: 70, wPct: 12, hPct: 3, signerRole: "AGENT", required: true },
  )
  return layout
}
