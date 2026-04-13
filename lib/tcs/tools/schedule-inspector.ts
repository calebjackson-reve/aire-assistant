// lib/tcs/tools/schedule-inspector.ts
// Day 9: Upgrade the inspector_booking draft created by auto-messages with the
// agent's preferred inspector pulled from the Vendor table. Respects the
// `preferred` flag (getTopVendor orders preferred DESC). If no inspector
// vendor exists, leaves the placeholder draft intact and logs a MEDIUM note.
//
// Callable from:
//   - lib/tcs/uc-flow.ts on UC entry
//   - POST /api/tcs/tools/schedule-inspector from the chat surface
//
// Never sends. All updates keep CommunicationLog.status = "draft".

import prisma from "@/lib/prisma"
import { getTopVendor, type Vendor } from "@/lib/tc/vendor-scheduler"
import { logAction, type SilentAction } from "../stage-actions"

export interface ScheduleInspectorInput {
  sessionId: string
  userId: string
  transactionId: string
}

export interface ScheduleInspectorResult {
  ok: boolean
  vendorId: string | null
  vendorName: string | null
  communicationLogId: string | null
  preferredUsed: boolean
  action: SilentAction
}

export async function scheduleInspectorTool(
  input: ScheduleInspectorInput,
): Promise<ScheduleInspectorResult> {
  const { sessionId, userId, transactionId } = input

  // 1. Find preferred inspector. getTopVendor returns preferred-first.
  const vendor = await getTopVendor("inspector", userId)

  // 2. Find transaction context (inspection window, property).
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      buyerName: true,
      contractDate: true,
    },
  })

  // 3. Find the existing inspector_booking draft created by auto-messages.
  // auto-messages tags metadata.tcsMessageKind = "inspector_booking".
  // We use jsonPath filter via raw findFirst on bodyPreview + subject fallback.
  const existingDraft = await prisma.communicationLog.findFirst({
    where: {
      userId,
      channel: "email",
      status: "draft",
      subject: {
        contains: "Inspection request",
      },
    },
    orderBy: { sentAt: "desc" },
  })

  // 4. No vendor → warn via silent action, leave placeholder in place.
  if (!vendor || !vendor.email) {
    const action = await logAction(sessionId, {
      kind: "note",
      summary: vendor
        ? `Inspector "${vendor.name}" saved but has no email — draft left with placeholder`
        : `No inspector on file — add one under Settings → Vendors to auto-book`,
      payload: {
        reason: vendor ? "missing_email" : "no_vendor",
        href: "/aire/settings/vendors",
      },
    })
    return {
      ok: false,
      vendorId: null,
      vendorName: vendor?.name ?? null,
      communicationLogId: existingDraft?.id ?? null,
      preferredUsed: false,
      action,
    }
  }

  // 5. Upgrade the draft with real vendor + richer body.
  const accessLine = "Listing side will coordinate access — I'll confirm as soon as you pick a slot."
  const subject = `Inspection request — ${tx?.propertyAddress ?? "property"}`
  const body = buildInspectorEmail({
    vendor,
    propertyAddress: tx?.propertyAddress ?? "(property)",
    buyerName: tx?.buyerName ?? null,
    accessLine,
  })

  let communicationLogId: string | null = null
  if (existingDraft) {
    const updated = await prisma.communicationLog.update({
      where: { id: existingDraft.id },
      data: {
        toAddress: vendor.email,
        subject,
        bodyPreview: previewFor(body),
        draftReply: body,
        metadata: {
          source: "tcs",
          tcsMessageKind: "inspector_booking",
          transactionId,
          sessionId,
          vendorId: vendor.name, // Vendor has no id in return type; name is unique-ish per user
          preferred: vendor.priority === 0,
        },
      },
      select: { id: true },
    })
    communicationLogId = updated.id
  } else {
    // If auto-messages didn't run (tool invoked standalone), create the draft.
    const agentEmail = (
      await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    )?.email ?? "agent@aireintel.org"
    const created = await prisma.communicationLog.create({
      data: {
        userId,
        channel: "email",
        direction: "outbound",
        fromAddress: agentEmail,
        toAddress: vendor.email,
        subject,
        bodyPreview: previewFor(body),
        sentAt: new Date(),
        status: "draft",
        draftReply: body,
        metadata: {
          source: "tcs",
          tcsMessageKind: "inspector_booking",
          transactionId,
          sessionId,
          vendorId: vendor.name,
          preferred: vendor.priority === 0,
        },
      },
      select: { id: true },
    })
    communicationLogId = created.id
  }

  const action = await logAction(sessionId, {
    kind: "message_drafted",
    summary: `Inspector booking ready for ${vendor.name}${vendor.priority === 0 ? " (preferred)" : ""}`,
    payload: {
      communicationLogId,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      preferred: vendor.priority === 0,
      href: `/aire/communications?filter=drafts&transactionId=${transactionId}`,
    },
  })

  return {
    ok: true,
    vendorId: vendor.name,
    vendorName: vendor.name,
    communicationLogId,
    preferredUsed: vendor.priority === 0,
    action,
  }
}

function previewFor(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280)
}

function buildInspectorEmail(args: {
  vendor: Vendor
  propertyAddress: string
  buyerName: string | null
  accessLine: string
}): string {
  const { vendor, propertyAddress, buyerName, accessLine } = args
  return `
    <p>Hi ${vendor.name.split(" ")[0] ?? vendor.name},</p>
    <p>Requesting an inspection booking for <strong>${propertyAddress}</strong>.</p>
    <ul>
      <li>Client: ${buyerName ?? "TBD"}</li>
      <li>Scope: Full inspection — structure, systems, roof. Termite if offered.</li>
      <li>Access: ${accessLine}</li>
      <li>Report: PDF at your usual turnaround.</li>
    </ul>
    <p>Let me know your earliest slot and I'll lock it in.</p>
    <p>Thanks.</p>
  `.trim()
}
