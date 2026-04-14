import prisma from "@/lib/prisma"
import { buildCertificate } from "./certificate"

/**
 * Compliance review + audit-export engine.
 *
 * Broker review workflow:
 *   submitForReview() → ComplianceReview row, envelope.requiresReview = true
 *   decideReview()    → APPROVE / REJECT / CHANGES_REQUESTED, updates envelope.requiresReview
 *   exportAuditZip()  → per-brokerage zip of sealed PDFs + CoCs + CSV index over a date range
 */

export async function submitForReview(envelopeId: string, userId: string) {
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    include: { complianceReview: true },
  })
  if (!envelope) throw new Error("Envelope not found")
  if (envelope.userId !== userId) throw new Error("Not your envelope")

  const membership = await prisma.brokerageMember.findUnique({ where: { userId } })
  if (!membership) throw new Error("Not in a brokerage — cannot submit for review")

  if (envelope.complianceReview?.status === "PENDING") {
    throw new Error("Already pending review")
  }

  const review = await prisma.complianceReview.upsert({
    where: { envelopeId },
    create: {
      envelopeId,
      brokerageId: membership.brokerageId,
      submittedById: userId,
      status: "PENDING",
    },
    update: {
      status: "PENDING",
      submittedById: userId,
      submittedAt: new Date(),
      reviewerId: null,
      reviewedAt: null,
      reviewerNote: null,
      requiredChanges: [],
    },
  })

  await prisma.airSignEnvelope.update({
    where: { id: envelopeId },
    data: { requiresReview: true, brokerageId: membership.brokerageId },
  })

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId,
      action: "submitted_for_review",
      metadata: { submittedBy: userId, reviewId: review.id },
    },
  })

  return review
}

export type ReviewDecision = "APPROVE" | "REJECT" | "CHANGES"

export async function decideReview(
  reviewId: string,
  reviewerId: string,
  decision: ReviewDecision,
  opts?: { note?: string; requiredChanges?: string[] }
) {
  const review = await prisma.complianceReview.findUnique({
    where: { id: reviewId },
    include: { envelope: true },
  })
  if (!review) throw new Error("Review not found")

  const nextStatus =
    decision === "APPROVE" ? "APPROVED" :
    decision === "REJECT" ? "REJECTED" :
    "CHANGES_REQUESTED"

  const updated = await prisma.complianceReview.update({
    where: { id: reviewId },
    data: {
      status: nextStatus,
      reviewerId,
      reviewedAt: new Date(),
      reviewerNote: opts?.note,
      requiredChanges: opts?.requiredChanges ?? [],
    },
  })

  if (decision === "APPROVE") {
    await prisma.airSignEnvelope.update({
      where: { id: review.envelopeId },
      data: { requiresReview: false },
    })
  }

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: review.envelopeId,
      action: `review_${decision.toLowerCase()}`,
      metadata: { reviewerId, note: opts?.note, requiredChanges: opts?.requiredChanges },
    },
  })

  return updated
}

/**
 * Build an audit-export manifest: CSV summary + a list of {envelopeId, url, certificateBytes}
 * triples that the API route can stream into a zip. Streaming happens in the route so we
 * don't buffer the whole zip in memory.
 */
export async function buildExportManifest(brokerageId: string, from: Date, to: Date) {
  const envelopes = await prisma.airSignEnvelope.findMany({
    where: { brokerageId, createdAt: { gte: from, lte: to } },
    include: {
      signers: { select: { name: true, email: true, signedAt: true } },
      complianceReview: { select: { status: true, reviewerId: true, reviewedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  const csvLines = [
    "envelope_id,name,status,created_at,sent_at,completed_at,signer_count,signed_count,review_status",
  ]
  for (const e of envelopes) {
    const signed = e.signers.filter((s) => s.signedAt).length
    csvLines.push(
      [
        e.id,
        csvEscape(e.name),
        e.status,
        e.createdAt.toISOString(),
        e.sentAt?.toISOString() ?? "",
        e.completedAt?.toISOString() ?? "",
        e.signers.length,
        signed,
        e.complianceReview?.status ?? "",
      ].join(",")
    )
  }

  return {
    csv: csvLines.join("\n"),
    envelopeIds: envelopes.map((e) => e.id),
    totalCount: envelopes.length,
  }
}

export async function buildAuditBundleForEnvelope(envelopeId: string) {
  const pdfBytes = await buildCertificate(envelopeId)
  const envelope = await prisma.airSignEnvelope.findUnique({
    where: { id: envelopeId },
    select: { name: true, documentUrl: true },
  })
  return {
    certificatePdf: pdfBytes,
    sealedDocumentUrl: envelope?.documentUrl ?? null,
    envelopeName: envelope?.name ?? envelopeId,
  }
}

function csvEscape(v: string | null | undefined): string {
  if (!v) return ""
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}
