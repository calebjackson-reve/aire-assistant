import prisma from "@/lib/prisma"
import { scanGmail } from "./gmail-scanner"
import { scanSms } from "./sms-scanner"
import { scanMissedCalls } from "./call-scanner"
import { ingestMessages, getUnanswered, markUnanswered } from "./response-detector"
import { generateDraftReplies } from "./draft-reply"
import { type CommsScanResult, type InboundMessage } from "./types"
import { classifyEmail, type ClassifierContext } from "./email-classifier"

/**
 * Full communication scan for a user:
 * 1. Scan Gmail for recent emails
 * 2. Scan Twilio for recent SMS
 * 3. Detect missed calls
 * 4. Ingest all messages and detect response pairs
 * 5. Mark stale outbound as unanswered
 * 6. Generate draft replies for urgent unanswered messages
 * 7. Return summary
 */
export async function runCommsScan(userId: string, sinceMins = 30): Promise<CommsScanResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error(`User ${userId} not found`)

  // 1-3: Scan all channels in parallel
  const [gmail, sms, missedCallCount] = await Promise.all([
    scanGmail(userId, sinceMins),
    scanSms(sinceMins),
    scanMissedCalls(userId, sinceMins),
  ])

  const allInbound = [...gmail.inbound, ...sms.inbound]
  const allOutbound = [...gmail.outbound, ...sms.outbound]

  // 4: Ingest messages and detect response pairs
  await ingestMessages(userId, allInbound, allOutbound)

  // 4b: Classify inbound emails (3-tier router: deal_related / work_related / personal)
  // Agent 4 — pure classifier, DB write happens here (not inside classifier).
  await classifyInboundEmails(userId, allInbound)

  // 5: Mark stale outbound as unanswered
  await markUnanswered(userId, 24)

  // 6: Get all unanswered inbound messages
  const unanswered = await getUnanswered(userId)

  // 7: Generate draft replies for urgent ones
  const agentName = user.firstName ?? "Agent"
  const drafts = await generateDraftReplies(unanswered, agentName)

  // Store drafts on the communication logs
  for (const [logId, draft] of drafts) {
    await prisma.communicationLog.update({
      where: { id: logId },
      data: { draftReply: draft },
    })
  }

  return {
    scannedAt: new Date(),
    newInbound: allInbound.length,
    newOutbound: allOutbound.length,
    unansweredCount: unanswered.length,
    missedCallCount: missedCallCount,
    unanswered,
  }
}

/**
 * Build classifier context (active transactions + vendor emails) and classify
 * every inbound email from this scan. Persists the result on the matching
 * CommunicationLog.metadata JSON blob.
 */
async function classifyInboundEmails(userId: string, inbound: InboundMessage[]) {
  const emails = inbound.filter((m) => m.channel === "email")
  if (emails.length === 0) return

  const txns = await prisma.transaction.findMany({
    where: { userId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    select: {
      id: true,
      propertyAddress: true,
      propertyCity: true,
      mlsNumber: true,
      buyerName: true,
      buyerEmail: true,
      sellerName: true,
      sellerEmail: true,
      lenderName: true,
      titleCompany: true,
    },
  })

  const ctx: ClassifierContext = {
    activeTransactions: txns,
    vendorEmails: [], // TODO: source from Vendor model when Agent 2 ships it
  }

  for (const msg of emails) {
    try {
      const result = await classifyEmail(
        {
          from: msg.from,
          subject: msg.subject ?? "",
          body: msg.bodyPreview ?? "",
        },
        ctx
      )

      const log = await prisma.communicationLog.findUnique({
        where: { externalId: msg.externalId },
      })
      if (!log) continue

      const existingMeta =
        (log.metadata && typeof log.metadata === "object" ? (log.metadata as Record<string, unknown>) : {}) || {}

      await prisma.communicationLog.update({
        where: { id: log.id },
        data: {
          metadata: JSON.parse(
            JSON.stringify({
              ...existingMeta,
              classification: {
                category: result.category,
                confidence: result.confidence,
                tier: result.tier,
                reason: result.reason,
                matchedTransactionId: result.matchedTransactionId ?? null,
                matchedSignals: result.matchedSignals ?? [],
                classifiedAt: new Date().toISOString(),
              },
            })
          ),
        },
      })
    } catch (err) {
      console.error(
        `[CommsScanner] Email classification failed for ${msg.externalId}:`,
        err instanceof Error ? err.message : err
      )
    }
  }
}
