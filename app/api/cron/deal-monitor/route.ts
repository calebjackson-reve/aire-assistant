// app/api/cron/deal-monitor/route.ts
//
// Deal Monitor Agent — runs every 4 hours.
// Checks all active transactions for: overdue deadlines, unsigned AirSign envelopes,
// stale deals (no activity in 5+ days), missing documents, and compliance gaps.
// Sends SMS alerts for CRITICAL items.

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendSms } from "@/lib/twilio"

export const maxDuration = 60

interface Alert {
  severity: "CRITICAL" | "URGENT" | "WATCH"
  address: string
  issue: string
  action: string
  transactionId: string
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = authHeader === `Bearer ${cronSecret}`
  const isManualTest = req.headers.get("x-aire-internal") === cronSecret

  if (!cronSecret || (!isVercelCron && !isManualTest)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const alerts: Alert[] = []
  const now = new Date()
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

  try {
    // Get all active transactions with deadlines and documents
    const transactions = await prisma.transaction.findMany({
      where: {
        status: { notIn: ["CLOSED", "CANCELLED", "TERMINATED"] },
      },
      include: {
        deadlines: true,
        documents: true,
      },
    })

    for (const txn of transactions) {
      const addr = txn.propertyAddress || `Transaction ${txn.id.slice(0, 8)}`

      // 1. Check deadlines
      for (const deadline of txn.deadlines) {
        if (deadline.completedAt) continue

        const due = new Date(deadline.dueDate)

        if (due < now) {
          // OVERDUE
          const daysOverdue = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
          alerts.push({
            severity: "CRITICAL",
            address: addr,
            issue: `${deadline.name} OVERDUE by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}`,
            action: `Complete ${deadline.name} immediately or request extension`,
            transactionId: txn.id,
          })
        } else if (due <= in48h) {
          alerts.push({
            severity: "URGENT",
            address: addr,
            issue: `${deadline.name} due ${due.toLocaleDateString()}`,
            action: `Ensure ${deadline.name} is on track`,
            transactionId: txn.id,
          })
        } else if (due <= in7d) {
          alerts.push({
            severity: "WATCH",
            address: addr,
            issue: `${deadline.name} due ${due.toLocaleDateString()}`,
            action: `Prepare for ${deadline.name}`,
            transactionId: txn.id,
          })
        }
      }

      // 2. Check for stale deals (no activity in 5+ days)
      const lastActivity = txn.updatedAt || txn.createdAt
      if (lastActivity < fiveDaysAgo) {
        const daysSince = Math.ceil((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        alerts.push({
          severity: "URGENT",
          address: addr,
          issue: `No activity in ${daysSince} days`,
          action: "Reach out to all parties for status update",
          transactionId: txn.id,
        })
      }

      // 3. Check closing proximity without title confirmation
      if (txn.closingDate) {
        const closing = new Date(txn.closingDate)
        const daysToClose = Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (daysToClose > 0 && daysToClose <= 14) {
          const hasTitleDoc = txn.documents.some(d =>
            d.type?.toLowerCase().includes("title") || d.name?.toLowerCase().includes("title")
          )
          if (!hasTitleDoc) {
            alerts.push({
              severity: daysToClose <= 7 ? "CRITICAL" : "URGENT",
              address: addr,
              issue: `Closing in ${daysToClose} days, no title work on file`,
              action: "Confirm title work status with title company",
              transactionId: txn.id,
            })
          }
        }
      }

      // 4. Check required documents
      const hasPropertyDisclosure = txn.documents.some(d =>
        d.type?.toLowerCase().includes("disclosure") || d.name?.toLowerCase().includes("disclosure")
      )
      if (!hasPropertyDisclosure && txn.status !== "PRE_LISTING") {
        alerts.push({
          severity: "WATCH",
          address: addr,
          issue: "Missing property disclosure",
          action: "Request property disclosure from seller",
          transactionId: txn.id,
        })
      }
    }

    // 5. Check unsigned AirSign envelopes
    try {
      const staleEnvelopes = await prisma.airSignEnvelope.findMany({
        where: {
          status: "SENT",
          sentAt: { lt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        },
      })

      for (const env of staleEnvelopes) {
        const daysSent = Math.ceil(
          (now.getTime() - new Date(env.sentAt!).getTime()) / (1000 * 60 * 60 * 24)
        )
        alerts.push({
          severity: daysSent >= 5 ? "CRITICAL" : "URGENT",
          address: env.name || `Envelope ${env.id.slice(0, 8)}`,
          issue: `AirSign envelope unsigned for ${daysSent} days`,
          action: "Resend signing reminder or call signer",
          transactionId: env.transactionId || "",
        })
      }
    } catch {
      // AirSign table may not exist yet
    }

    // Sort by severity
    const severityOrder = { CRITICAL: 0, URGENT: 1, WATCH: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    // SMS alert for critical items
    const criticals = alerts.filter(a => a.severity === "CRITICAL")
    if (criticals.length > 0) {
      const alertPhone = process.env.ALERT_PHONE_NUMBER
      const msg = `AIRE Deal Monitor: ${criticals.length} CRITICAL\n${criticals
        .slice(0, 3)
        .map(c => `${c.address}: ${c.issue}`)
        .join("\n")}`

      console.error("[DEAL-MONITOR]", msg)

      if (alertPhone) {
        await sendSms(alertPhone, msg.substring(0, 160))
      }
    }

    // Log agent run
    try {
      const adminUser = await prisma.user.findFirst({ where: { tier: "INVESTOR" } })
      if (adminUser) {
        await prisma.agentRun.create({
          data: {
            userId: adminUser.id,
            agentName: "deal_monitor",
            status: "success",
            completedAt: new Date(),
            durationMs: Date.now() - start,
            resultMetadata: {
              totalDeals: transactions.length,
              criticals: criticals.length,
              urgents: alerts.filter(a => a.severity === "URGENT").length,
              watches: alerts.filter(a => a.severity === "WATCH").length,
            },
          },
        })
      }
    } catch {
      // AgentRun logging is best-effort
    }

    const summary = {
      agent: "deal-monitor",
      timestamp: new Date().toISOString(),
      totalDeals: transactions.length,
      totalAlerts: alerts.length,
      critical: criticals.length,
      urgent: alerts.filter(a => a.severity === "URGENT").length,
      watch: alerts.filter(a => a.severity === "WATCH").length,
      alerts,
      processingMs: Date.now() - start,
    }

    console.log(
      `[DEAL-MONITOR] ${transactions.length} deals scanned, ${alerts.length} alerts (${criticals.length} critical) in ${summary.processingMs}ms`
    )

    return NextResponse.json(summary)
  } catch (err) {
    console.error("[DEAL-MONITOR] Failed:", err)
    return NextResponse.json(
      { error: "Deal monitor failed", details: String(err) },
      { status: 500 }
    )
  }
}
