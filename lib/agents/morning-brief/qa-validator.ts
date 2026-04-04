// lib/agents/morning-brief/qa-validator.ts
// Takes combined researcher output, runs Fair Housing check and LREC completeness check.

import type { DeadlineResearchResult } from "./researchers/deadline-researcher"
import type { PipelineResearchResult } from "./researchers/pipeline-researcher"
import type { ContactResearchResult } from "./researchers/contact-researcher"

export interface QAFlag {
  type: "fair_housing" | "lrec_compliance" | "data_quality"
  severity: "red" | "yellow" | "info"
  message: string
  source: string
}

export interface QAResult {
  passed: boolean
  flags: QAFlag[]
  checkedAt: Date
}

// Words/phrases that could indicate Fair Housing violations if used in outreach
const FAIR_HOUSING_TERMS = [
  "family status", "familial", "children", "kids", "married",
  "single", "religion", "church", "mosque", "synagogue",
  "race", "ethnic", "national origin", "disability", "handicap",
  "sex", "gender", "pregnant",
]

export function validateBriefData(
  deadlines: DeadlineResearchResult | null,
  pipeline: PipelineResearchResult | null,
  contacts: ContactResearchResult | null,
): QAResult {
  const flags: QAFlag[] = []

  // ── Fair Housing check on contact outreach suggestions ──
  if (contacts) {
    for (const list of [contacts.hotLeads, contacts.needsFollow, contacts.recentIntel]) {
      for (const c of list) {
        if (c.suggestedMessage) {
          const lower = c.suggestedMessage.toLowerCase()
          for (const term of FAIR_HOUSING_TERMS) {
            if (lower.includes(term)) {
              flags.push({
                type: "fair_housing",
                severity: "red",
                message: `Suggested message for ${c.firstName} ${c.lastName} contains protected-class term "${term}". Remove before sending.`,
                source: `contact:${c.id}`,
              })
            }
          }
        }
      }
    }
  }

  // ── LREC completeness check on pipeline deals ──
  if (pipeline) {
    for (const deal of pipeline.activeDeals) {
      if (deal.status !== "DRAFT" && !deal.buyerName && !deal.sellerName) {
        flags.push({
          type: "lrec_compliance",
          severity: "yellow",
          message: `${deal.propertyAddress}: Active transaction has no buyer or seller name. LREC requires identified parties.`,
          source: `transaction:${deal.id}`,
        })
      }
      if (deal.closingDate && deal.daysUntilClosing !== null && deal.daysUntilClosing <= 3 && deal.missingDocCount > 0) {
        flags.push({
          type: "lrec_compliance",
          severity: "red",
          message: `${deal.propertyAddress}: Closing in ${deal.daysUntilClosing} days with ${deal.missingDocCount} missing documents. Act of Sale may be delayed.`,
          source: `transaction:${deal.id}`,
        })
      }
    }
  }

  // ── Data quality checks ──
  if (deadlines && deadlines.overdue.length > 0) {
    flags.push({
      type: "data_quality",
      severity: "yellow",
      message: `${deadlines.overdue.length} overdue deadline(s) found. Confirm these are still relevant or mark complete.`,
      source: "deadlines",
    })
  }

  const hasRed = flags.some((f) => f.severity === "red")

  return {
    passed: !hasRed,
    flags,
    checkedAt: new Date(),
  }
}
