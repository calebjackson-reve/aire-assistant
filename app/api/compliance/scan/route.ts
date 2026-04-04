import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import {
  calculateDeadlines,
  getUpcomingDeadlines,
  type TransactionDates,
  type CalculatedDeadline,
} from "@/lib/louisiana-rules-engine"
import { consensusCheck, CONSENSUS_PRESETS } from "@/lib/agents/consensus"

export interface ComplianceIssue {
  transactionId: string
  propertyAddress: string
  category: "deadline" | "document" | "party" | "fair_housing"
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  dueDate?: string
  daysRemaining?: number
}

export interface ComplianceScanResult {
  scannedAt: string
  totalTransactions: number
  issues: ComplianceIssue[]
  deadlines: Array<CalculatedDeadline & { transactionId: string; propertyAddress: string }>
  score: number // 0-100 overall compliance health
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        include: {
          deadlines: { where: { completedAt: null } },
          documents: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const issues: ComplianceIssue[] = []
  const allDeadlines: Array<CalculatedDeadline & { transactionId: string; propertyAddress: string }> = []

  for (const txn of user.transactions) {
    // Calculate deadlines from rules engine
    if (txn.contractDate) {
      const input: TransactionDates = {
        contractDate: new Date(txn.contractDate),
        closingDate: txn.closingDate ? new Date(txn.closingDate) : undefined,
      }
      const deadlines = calculateDeadlines(input)
      const upcoming = getUpcomingDeadlines(deadlines, 7)

      for (const d of deadlines) {
        allDeadlines.push({ ...d, transactionId: txn.id, propertyAddress: txn.propertyAddress })
      }

      // Flag overdue deadlines
      const now = new Date()
      for (const d of deadlines) {
        const daysRemaining = Math.ceil((d.dueDate.getTime() - now.getTime()) / 86400000)
        if (daysRemaining < 0) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "deadline",
            severity: "critical",
            title: `${d.name} overdue`,
            description: `${d.name} was due ${Math.abs(daysRemaining)} day(s) ago. ${d.description}`,
            dueDate: d.dueDate.toISOString(),
            daysRemaining,
          })
        } else if (daysRemaining <= 3) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "deadline",
            severity: "warning",
            title: `${d.name} due in ${daysRemaining} day(s)`,
            description: d.description,
            dueDate: d.dueDate.toISOString(),
            daysRemaining,
          })
        }
      }
    } else if (txn.status !== "DRAFT") {
      issues.push({
        transactionId: txn.id,
        propertyAddress: txn.propertyAddress,
        category: "deadline",
        severity: "warning",
        title: "No contract date set",
        description: "Cannot calculate LREC deadlines without a contract acceptance date.",
      })
    }

    // Party completeness
    if (txn.status !== "DRAFT") {
      if (!txn.buyerName && !txn.sellerName) {
        issues.push({
          transactionId: txn.id,
          propertyAddress: txn.propertyAddress,
          category: "party",
          severity: "critical",
          title: "No parties identified",
          description: "LREC requires identified buyer and seller on all active transactions.",
        })
      }
      if (!txn.titleCompany && txn.closingDate) {
        const daysToClose = Math.ceil((new Date(txn.closingDate).getTime() - Date.now()) / 86400000)
        if (daysToClose <= 30) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "party",
            severity: "warning",
            title: "No title company assigned",
            description: `Closing in ${daysToClose} days but no title company on file.`,
          })
        }
      }
    }

    // Document completeness — check for mandatory docs
    const docTypes = new Set(txn.documents.map((d) => d.type))
    const mandatoryDocs = ["purchase_agreement", "property_disclosure", "agency_disclosure", "lead_paint"]
    if (txn.status !== "DRAFT") {
      for (const docType of mandatoryDocs) {
        if (!docTypes.has(docType)) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "document",
            severity: txn.closingDate && Math.ceil((new Date(txn.closingDate).getTime() - Date.now()) / 86400000) <= 14 ? "critical" : "warning",
            title: `Missing ${docType.replace(/_/g, " ")}`,
            description: `Louisiana LREC requires ${docType.replace(/_/g, " ")} for all residential transactions.`,
          })
        }
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Score: 100 = no issues, deduct per issue
  const criticalCount = issues.filter((i) => i.severity === "critical").length
  const warningCount = issues.filter((i) => i.severity === "warning").length
  const score = Math.max(0, 100 - criticalCount * 15 - warningCount * 5)

  const result: ComplianceScanResult = {
    scannedAt: new Date().toISOString(),
    totalTransactions: user.transactions.length,
    issues,
    deadlines: allDeadlines,
    score,
  }

  return NextResponse.json(result)
}
