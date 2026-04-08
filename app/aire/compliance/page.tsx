import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import {
  calculateDeadlines,
  getUpcomingDeadlines,
  type TransactionDates,
  type CalculatedDeadline,
} from "@/lib/louisiana-rules-engine"
import { FeedbackButtons } from "@/components/FeedbackButtons"

interface ComplianceIssue {
  transactionId: string
  propertyAddress: string
  category: "deadline" | "document" | "party"
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  dueDate?: string
  daysRemaining?: number
}

export default async function CompliancePage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in?redirect_url=/aire/compliance")

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

  if (!user) redirect("/sign-in")

  const issues: ComplianceIssue[] = []
  const allDeadlines: Array<CalculatedDeadline & { transactionId: string; propertyAddress: string }> = []
  const now = new Date()

  for (const txn of user.transactions) {
    if (txn.contractDate) {
      const input: TransactionDates = {
        contractDate: new Date(txn.contractDate),
        closingDate: txn.closingDate ? new Date(txn.closingDate) : undefined,
      }
      const deadlines = calculateDeadlines(input)

      for (const d of deadlines) {
        allDeadlines.push({ ...d, transactionId: txn.id, propertyAddress: txn.propertyAddress })
      }

      for (const d of deadlines) {
        const daysRemaining = Math.ceil((d.dueDate.getTime() - now.getTime()) / 86400000)
        if (daysRemaining < 0) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "deadline",
            severity: "critical",
            title: `${d.name} overdue`,
            description: `Was due ${Math.abs(daysRemaining)} day(s) ago. ${d.description}`,
            dueDate: d.dueDate.toISOString(),
            daysRemaining,
          })
        } else if (daysRemaining <= 3) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "deadline",
            severity: "warning",
            title: `${d.name} due in ${daysRemaining}d`,
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
        title: "No contract date",
        description: "Cannot calculate LREC deadlines without a contract acceptance date.",
      })
    }

    if (txn.status !== "DRAFT") {
      if (!txn.buyerName && !txn.sellerName) {
        issues.push({
          transactionId: txn.id,
          propertyAddress: txn.propertyAddress,
          category: "party",
          severity: "critical",
          title: "No parties identified",
          description: "LREC requires identified buyer and seller on active transactions.",
        })
      }
      if (!txn.titleCompany && txn.closingDate) {
        const daysToClose = Math.ceil((new Date(txn.closingDate).getTime() - now.getTime()) / 86400000)
        if (daysToClose <= 30) {
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "party",
            severity: "warning",
            title: "No title company",
            description: `Closing in ${daysToClose}d with no title company assigned.`,
          })
        }
      }

      const docTypes = new Set(txn.documents.map((d) => d.type))
      const mandatoryDocs = ["purchase_agreement", "property_disclosure", "agency_disclosure", "lead_paint"]
      for (const docType of mandatoryDocs) {
        if (!docTypes.has(docType)) {
          const closingSoon = txn.closingDate && Math.ceil((new Date(txn.closingDate).getTime() - now.getTime()) / 86400000) <= 14
          issues.push({
            transactionId: txn.id,
            propertyAddress: txn.propertyAddress,
            category: "document",
            severity: closingSoon ? "critical" : "warning",
            title: `Missing ${docType.replace(/_/g, " ")}`,
            description: `LREC requires ${docType.replace(/_/g, " ")} for residential transactions.`,
          })
        }
      }
    }
  }

  issues.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  const criticalCount = issues.filter((i) => i.severity === "critical").length
  const warningCount = issues.filter((i) => i.severity === "warning").length
  const score = Math.max(0, 100 - criticalCount * 15 - warningCount * 5)

  // Upcoming deadlines within 14 days
  const upcomingDeadlines = allDeadlines
    .filter((d) => {
      const days = Math.ceil((d.dueDate.getTime() - now.getTime()) / 86400000)
      return days >= 0 && days <= 14
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
            Compliance Monitor
          </h1>
          <p className="text-cream-dim text-sm mt-1">
            Louisiana LREC rules engine · {user.transactions.length} active transaction{user.transactions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ComplianceScore score={score} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Compliance Score" value={`${score}%`} color={score >= 80 ? "green" : score >= 50 ? "amber" : "red"} />
        <StatCard label="Critical Issues" value={String(criticalCount)} color={criticalCount > 0 ? "red" : "green"} />
        <StatCard label="Warnings" value={String(warningCount)} color={warningCount > 0 ? "amber" : "green"} />
        <StatCard label="Deadlines (14d)" value={String(upcomingDeadlines.length)} color={upcomingDeadlines.length > 3 ? "amber" : "green"} />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="mb-10">
          <h2 className="text-cream font-medium mb-4">Issues requiring attention</h2>
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <IssueCard key={`${issue.transactionId}-${i}`} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {issues.length === 0 && (
        <div className="border border-status-green/20 rounded-xl p-8 text-center mb-10 bg-status-green/5">
          <p className="text-status-green text-lg font-medium">All clear</p>
          <p className="text-cream-dim text-sm mt-1">No compliance issues detected across your active transactions.</p>
        </div>
      )}

      {/* Feedback on compliance scan accuracy */}
      <div className="flex justify-end mb-6">
        <FeedbackButtons
          feature="compliance_scan"
          metadata={{ score, criticalCount, warningCount, issueCount: issues.length }}
          className="[&_span]:text-cream-dim/40 [&_button]:text-cream-dim/40 [&_button:hover]:text-green-400 [&_button:last-child:hover]:text-red-400"
        />
      </div>

      {/* Upcoming Deadlines Timeline */}
      {upcomingDeadlines.length > 0 && (
        <div>
          <h2 className="text-cream font-medium mb-4">Upcoming deadlines</h2>
          <div className="space-y-2">
            {upcomingDeadlines.map((d, i) => {
              const days = Math.ceil((d.dueDate.getTime() - now.getTime()) / 86400000)
              return (
                <div key={`${d.transactionId}-${d.name}-${i}`} className="border border-brown-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-cream text-sm font-medium">{d.name}</p>
                    <p className="text-cream-dim text-xs mt-0.5">
                      {d.propertyAddress} · {d.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      d.priority === "high" ? "text-status-red bg-status-red/10" :
                      d.priority === "medium" ? "text-status-amber bg-status-amber/10" :
                      "text-cream-dim bg-brown-light/30"
                    }`}>
                      {d.priority}
                    </span>
                    <span className={`text-sm font-medium ${days <= 2 ? "text-status-red" : days <= 5 ? "text-status-amber" : "text-cream"}`}>
                      {days}d
                    </span>
                    <span className="text-cream-dim text-xs">
                      {d.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Transaction-level breakdown */}
      {user.transactions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-cream font-medium mb-4">Transaction compliance</h2>
          <div className="space-y-2">
            {user.transactions.map((txn) => {
              const txnIssues = issues.filter((i) => i.transactionId === txn.id)
              const txnCritical = txnIssues.filter((i) => i.severity === "critical").length
              const txnWarning = txnIssues.filter((i) => i.severity === "warning").length
              return (
                <div key={txn.id} className="border border-brown-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-cream text-sm font-medium">{txn.propertyAddress}</p>
                    <p className="text-cream-dim text-xs mt-0.5">
                      {txn.buyerName || txn.sellerName || "No parties"} · {txn.status.replace(/_/g, " ").toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {txnCritical > 0 && (
                      <span className="text-xs text-status-red bg-status-red/10 px-2 py-0.5 rounded">
                        {txnCritical} critical
                      </span>
                    )}
                    {txnWarning > 0 && (
                      <span className="text-xs text-status-amber bg-status-amber/10 px-2 py-0.5 rounded">
                        {txnWarning} warning{txnWarning > 1 ? "s" : ""}
                      </span>
                    )}
                    {txnIssues.length === 0 && (
                      <span className="text-xs text-status-green bg-status-green/10 px-2 py-0.5 rounded">
                        compliant
                      </span>
                    )}
                    <span className="text-cream-dim text-xs">{txn.documents.length} docs</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ComplianceScore({ score }: { score: number }) {
  const color = score >= 80 ? "text-status-green" : score >= 50 ? "text-status-amber" : "text-status-red"
  const ringColor = score >= 80 ? "stroke-status-green" : score >= 50 ? "stroke-status-amber" : "stroke-status-red"
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(242,232,222,0.08)" strokeWidth="5" />
        <circle
          cx="40" cy="40" r="36"
          fill="none"
          className={ringColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-medium ${color}`}>{score}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: "green" | "amber" | "red" }) {
  const colorMap = {
    green: "text-status-green",
    amber: "text-status-amber",
    red: "text-status-red",
  }

  return (
    <div className="border border-brown-border rounded-lg p-4">
      <p className="text-cream-dim text-xs mb-1">{label}</p>
      <p className={`text-2xl font-light ${colorMap[color]}`}>{value}</p>
    </div>
  )
}

function IssueCard({ issue }: { issue: ComplianceIssue }) {
  const severityStyles = {
    critical: "border-status-red/30 bg-status-red/5",
    warning: "border-status-amber/30 bg-status-amber/5",
    info: "border-brown-border bg-transparent",
  }
  const severityLabel = {
    critical: "text-status-red bg-status-red/10",
    warning: "text-status-amber bg-status-amber/10",
    info: "text-cream-dim bg-brown-light/30",
  }
  const categoryLabel = {
    deadline: "Deadline",
    document: "Document",
    party: "Party Info",
    fair_housing: "Fair Housing",
  }

  return (
    <div className={`border rounded-lg p-4 ${severityStyles[issue.severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${severityLabel[issue.severity]}`}>
              {issue.severity}
            </span>
            <span className="text-cream-dim text-[10px] uppercase tracking-wider">
              {categoryLabel[issue.category]}
            </span>
          </div>
          <p className="text-cream text-sm font-medium">{issue.title}</p>
          <p className="text-cream-dim text-xs mt-0.5">{issue.propertyAddress}</p>
          <p className="text-cream-dim/70 text-xs mt-1">{issue.description}</p>
        </div>
        {issue.daysRemaining !== undefined && (
          <span className={`text-sm font-medium shrink-0 ${issue.daysRemaining < 0 ? "text-status-red" : "text-status-amber"}`}>
            {issue.daysRemaining < 0 ? `${Math.abs(issue.daysRemaining)}d overdue` : `${issue.daysRemaining}d`}
          </span>
        )}
      </div>
    </div>
  )
}
