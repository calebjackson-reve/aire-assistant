// AIRE MCP tool registry — stub definitions for the C3 scaffold. The real
// implementations wrap existing API routes and ship with app/api/mcp/route.ts
// in a later pass. This file exists so the landing page has a concrete source
// of truth for the capability list; keep it in sync with the MCP server when
// that lands.

export type ToolCategory =
  | "transactions"
  | "airsign"
  | "contracts"
  | "intelligence"
  | "communications"
  | "compliance"
  | "brief"

export interface AssistantTool {
  name: string
  label: string
  description: string
  category: ToolCategory
  confirmRequired: boolean
}

export const ASSISTANT_TOOLS: readonly AssistantTool[] = [
  {
    name: "listTransactions",
    label: "List transactions",
    description: "See every active deal with status, closing date, and pipeline value.",
    category: "transactions",
    confirmRequired: false,
  },
  {
    name: "getTransaction",
    label: "Open a transaction",
    description: "Pull the full file for one deal — parties, deadlines, docs.",
    category: "transactions",
    confirmRequired: false,
  },
  {
    name: "listDeadlines",
    label: "Check deadlines",
    description: "What's due today, this week, and what's already overdue.",
    category: "transactions",
    confirmRequired: false,
  },
  {
    name: "completeDeadline",
    label: "Complete a deadline",
    description: "Mark a contract deadline as met and advance the workflow.",
    category: "transactions",
    confirmRequired: true,
  },
  {
    name: "createEnvelope",
    label: "Send for signature",
    description: "Build an AirSign envelope from a PDF and dispatch to signers.",
    category: "airsign",
    confirmRequired: true,
  },
  {
    name: "writeContract",
    label: "Write a contract",
    description: "Generate a Louisiana LREC form from natural language.",
    category: "contracts",
    confirmRequired: true,
  },
  {
    name: "listContracts",
    label: "Review contracts",
    description: "Every generated document with signing status and party.",
    category: "contracts",
    confirmRequired: false,
  },
  {
    name: "runCompliance",
    label: "Run compliance scan",
    description: "Audit a deal against the Louisiana rules engine.",
    category: "compliance",
    confirmRequired: false,
  },
  {
    name: "scheduleVendor",
    label: "Schedule a vendor",
    description: "Book inspector, appraiser, or closing attorney from saved vendors.",
    category: "communications",
    confirmRequired: true,
  },
  {
    name: "sendUpdate",
    label: "Send a party update",
    description: "Message buyer, seller, or co-op agent with a templated or custom note.",
    category: "communications",
    confirmRequired: true,
  },
  {
    name: "getEmailTriage",
    label: "Triage the inbox",
    description: "Missed calls, emails needing reply, and ready-to-send drafts.",
    category: "communications",
    confirmRequired: false,
  },
  {
    name: "getCMA",
    label: "Pull a CMA",
    description: "Run the ensemble AVM and neighborhood comps for any address.",
    category: "intelligence",
    confirmRequired: false,
  },
  {
    name: "getScore",
    label: "Check AIRE score",
    description: "Deal or listing score with confidence tier and driver breakdown.",
    category: "intelligence",
    confirmRequired: false,
  },
  {
    name: "searchProperties",
    label: "Search properties",
    description: "Query the scored property index by address, parish, or ZIP.",
    category: "intelligence",
    confirmRequired: false,
  },
  {
    name: "getMorningBrief",
    label: "Read the morning brief",
    description: "Today's deadlines, pipeline movement, contacts, and action items.",
    category: "brief",
    confirmRequired: false,
  },
]

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  transactions: "Transactions",
  airsign: "AirSign",
  contracts: "Contracts",
  intelligence: "Intelligence",
  communications: "Communications",
  compliance: "Compliance",
  brief: "Morning brief",
}
