/**
 * MCP tool definitions for AIRE.
 *
 * Each tool wraps an existing API route (see AGENT_BRIEFS.md §C3). Handlers
 * forward the validated input to the owning route so behavior stays co-located
 * with the feature, not duplicated in the MCP layer.
 *
 * Wraps voice-pipeline v2 surface area — does not replace it.
 */

import { z } from "zod"

export interface ToolContext {
  userId: string
  baseUrl: string
  internalSecret?: string
}

export interface ToolDefinition<TInput = unknown> {
  name: string
  description: string
  /** JSON Schema shape returned by tools/list (MCP wire format). */
  inputSchema: {
    type: "object"
    properties: Record<string, JSONSchemaProperty>
    required?: string[]
    additionalProperties?: boolean
  }
  /** Runtime validator. */
  zodSchema: z.ZodType<TInput>
  handler: (input: TInput, ctx: ToolContext) => Promise<unknown>
}

type JSONSchemaProperty = {
  type?: string | string[]
  description?: string
  enum?: readonly (string | number | boolean)[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  required?: string[]
  format?: string
}

type ToolDefinitionInput<S extends z.ZodType> = {
  name: string
  description: string
  inputSchema: ToolDefinition["inputSchema"]
  zodSchema: S
  handler: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>
}

function defineTool<S extends z.ZodType>(
  def: ToolDefinitionInput<S>,
): ToolDefinition<z.infer<S>> {
  return def as unknown as ToolDefinition<z.infer<S>>
}

// ─── HTTP HELPER ────────────────────────────────────────────────────────────

async function forward(
  ctx: ToolContext,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(path, ctx.baseUrl).toString()
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-aire-mcp-user-id": ctx.userId,
  }
  if (ctx.internalSecret) {
    headers["x-aire-internal-secret"] = ctx.internalSecret
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    throw new Error(
      `MCP forward ${method} ${path} failed: ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`,
    )
  }
  return data
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ─── 1. SEND UPDATE (wraps /api/tc/send-update) ─────────────────────────────

const sendUpdateSchema = z.object({
  transactionId: z.string().min(1),
  template: z.enum(["offer_accepted", "inspection", "closing", "update"]),
  customMessage: z.string().optional(),
  channel: z.enum(["email", "sms", "both"]).optional(),
})

const sendUpdate = defineTool({
  name: "send-update",
  description:
    "Send a status update to transaction parties via email/SMS using a template (offer_accepted | inspection | closing | update).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      transactionId: { type: "string", description: "AIRE transaction id" },
      template: {
        type: "string",
        enum: ["offer_accepted", "inspection", "closing", "update"],
        description: "Message template key",
      },
      customMessage: { type: "string" },
      channel: { type: "string", enum: ["email", "sms", "both"] },
    },
    required: ["transactionId", "template"],
  },
  zodSchema: sendUpdateSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/tc/send-update", input),
})

// ─── 2. WRITE CONTRACT (wraps /api/contracts/write) ─────────────────────────

const writeContractSchema = z.object({
  naturalLanguage: z.string().optional(),
  formType: z.string().optional(),
  transactionId: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  sendForSignature: z.boolean().optional(),
})

const writeContract = defineTool({
  name: "write-contract",
  description:
    "Generate an LREC contract from natural language or structured fields. Optionally send via AirSign for signature.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      naturalLanguage: {
        type: "string",
        description: "Plain-English contract instructions",
      },
      formType: {
        type: "string",
        description: "LREC form key (e.g. PURCHASE_AGREEMENT)",
      },
      transactionId: { type: "string" },
      fields: { type: "object" },
      sendForSignature: { type: "boolean" },
    },
  },
  zodSchema: writeContractSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/contracts/write", input),
})

// ─── 3. RUN CMA (wraps /api/intelligence/cma) ───────────────────────────────

const runCmaSchema = z.object({
  address: z.string().min(1),
  radiusMiles: z.number().positive().max(10).optional(),
  lookbackMonths: z.number().positive().max(36).optional(),
  propertyType: z.string().optional(),
})

const runCma = defineTool({
  name: "run-cma",
  description:
    "Run a Comparative Market Analysis (ensemble + PPS + neighborhood) for a property address.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      address: { type: "string" },
      radiusMiles: { type: "number" },
      lookbackMonths: { type: "number" },
      propertyType: { type: "string" },
    },
    required: ["address"],
  },
  zodSchema: runCmaSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/intelligence/cma", input),
})

// ─── 4. SCAN COMPLIANCE (wraps /api/compliance/scan) ────────────────────────

const scanComplianceSchema = z.object({
  transactionId: z.string().optional(),
  documentId: z.string().optional(),
})

const scanCompliance = defineTool({
  name: "scan-compliance",
  description:
    "Run Louisiana rules engine compliance scan on a transaction or document. Returns findings with severity.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      transactionId: { type: "string" },
      documentId: { type: "string" },
    },
  },
  zodSchema: scanComplianceSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/compliance/scan", input),
})

// ─── 5. SCHEDULE VENDOR (wraps /api/tc/schedule-vendor) ─────────────────────

const scheduleVendorSchema = z.object({
  transactionId: z.string().min(1),
  vendorType: z.enum([
    "inspection",
    "appraisal",
    "photography",
    "title",
    "survey",
    "other",
  ]),
  vendorId: z.string().optional(),
  requestedDate: z.string().optional(),
  notes: z.string().optional(),
})

const scheduleVendor = defineTool({
  name: "schedule-vendor",
  description:
    "Schedule a vendor (inspection / appraisal / photography / title / survey) against a transaction.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      transactionId: { type: "string" },
      vendorType: {
        type: "string",
        enum: [
          "inspection",
          "appraisal",
          "photography",
          "title",
          "survey",
          "other",
        ],
      },
      vendorId: { type: "string" },
      requestedDate: { type: "string", format: "date-time" },
      notes: { type: "string" },
    },
    required: ["transactionId", "vendorType"],
  },
  zodSchema: scheduleVendorSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/tc/schedule-vendor", input),
})

// ─── 6. CLASSIFY DOC (wraps /api/documents/upload) ──────────────────────────

const classifyDocSchema = z.object({
  transactionId: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileId: z.string().optional(),
  mimeType: z.string().optional(),
})

const classifyDoc = defineTool({
  name: "classify-doc",
  description:
    "Classify + extract fields from an uploaded document (LREC form detection, multi-pass extraction).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      transactionId: { type: "string" },
      fileUrl: { type: "string", format: "uri" },
      fileId: { type: "string" },
      mimeType: { type: "string" },
    },
  },
  zodSchema: classifyDocSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/documents/upload", input),
})

// ─── 7. SEND ENVELOPE (wraps /api/airsign/envelopes/[id]/send) ──────────────

const sendEnvelopeSchema = z.object({
  envelopeId: z.string().min(1),
  subject: z.string().optional(),
  message: z.string().optional(),
})

const sendEnvelope = defineTool({
  name: "send-envelope",
  description:
    "Send an AirSign envelope to its signers (email + signing links). Envelope must already have fields placed.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      envelopeId: { type: "string" },
      subject: { type: "string" },
      message: { type: "string" },
    },
    required: ["envelopeId"],
  },
  zodSchema: sendEnvelopeSchema,
  handler: async (input, ctx) =>
    forward(
      ctx,
      "POST",
      `/api/airsign/envelopes/${encodeURIComponent(input.envelopeId)}/send`,
      { subject: input.subject, message: input.message },
    ),
})

// ─── 8. TRIGGER MORNING BRIEF (wraps /api/tc/morning-brief) ─────────────────

const triggerMorningBriefSchema = z.object({
  force: z.boolean().optional(),
  dateIso: z.string().optional(),
})

const triggerMorningBrief = defineTool({
  name: "trigger-morning-brief",
  description:
    "Generate (or regenerate) today's TC morning brief for the current user.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      force: { type: "boolean" },
      dateIso: { type: "string", format: "date" },
    },
  },
  zodSchema: triggerMorningBriefSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/tc/morning-brief", input),
})

// ─── 9. SCAN EMAIL (wraps /api/email/scan-now) ──────────────────────────────

const scanEmailSchema = z.object({
  accountId: z.string().optional(),
  sinceIso: z.string().optional(),
})

const scanEmail = defineTool({
  name: "scan-email",
  description:
    "Run an immediate inbox scan for the user's connected Gmail — populates triage queue.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      accountId: { type: "string" },
      sinceIso: { type: "string", format: "date-time" },
    },
  },
  zodSchema: scanEmailSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/email/scan-now", input),
})

// ─── 10. CREATE TRANSACTION (wraps POST /api/transactions) ──────────────────

const createTransactionSchema = z.object({
  propertyAddress: z.string().min(1),
  listPrice: z.number().optional(),
  contractPrice: z.number().optional(),
  buyerName: z.string().optional(),
  sellerName: z.string().optional(),
  mlsNumber: z.string().optional(),
  closingDate: z.string().optional(),
  inspectionDate: z.string().optional(),
  status: z.string().optional(),
})

const createTransaction = defineTool({
  name: "create-transaction",
  description:
    "Create a new TC transaction (property + parties + key dates). Returns the transaction id.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      propertyAddress: { type: "string" },
      listPrice: { type: "number" },
      contractPrice: { type: "number" },
      buyerName: { type: "string" },
      sellerName: { type: "string" },
      mlsNumber: { type: "string" },
      closingDate: { type: "string", format: "date" },
      inspectionDate: { type: "string", format: "date" },
      status: { type: "string" },
    },
    required: ["propertyAddress"],
  },
  zodSchema: createTransactionSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/transactions", input),
})

// ─── 11. ADVANCE WORKFLOW (wraps lib/workflow/state-machine) ────────────────

const advanceWorkflowSchema = z.object({
  transactionId: z.string().min(1),
  targetStatus: z.string().optional(),
  trigger: z.string().optional(),
  notes: z.string().optional(),
})

const advanceWorkflow = defineTool({
  name: "advance-workflow",
  description:
    "Advance a transaction's workflow state. Uses lib/workflow/state-machine via an internal route.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      transactionId: { type: "string" },
      targetStatus: { type: "string" },
      trigger: { type: "string" },
      notes: { type: "string" },
    },
    required: ["transactionId"],
  },
  zodSchema: advanceWorkflowSchema,
  handler: async (input, ctx) =>
    forward(
      ctx,
      "PATCH",
      `/api/transactions/${encodeURIComponent(input.transactionId)}`,
      {
        workflow: {
          targetStatus: input.targetStatus,
          trigger: input.trigger ?? "mcp_client",
          notes: input.notes,
        },
      },
    ),
})

// ─── 12. DRAFT REPLY (wraps /api/email/draft-reply) ─────────────────────────

const draftReplySchema = z.object({
  messageId: z.string().min(1),
  tone: z.enum(["concise", "friendly", "formal"]).optional(),
  instructions: z.string().optional(),
})

const draftReply = defineTool({
  name: "draft-reply",
  description:
    "Draft a reply to a specific email message using Caleb's voice. Returns draft text (does not send).",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      messageId: { type: "string" },
      tone: { type: "string", enum: ["concise", "friendly", "formal"] },
      instructions: { type: "string" },
    },
    required: ["messageId"],
  },
  zodSchema: draftReplySchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/email/draft-reply", input),
})

// ─── 13. GET PIPELINE (wraps GET /api/transactions aggregate) ───────────────

const getPipelineSchema = z.object({
  status: z.string().optional(),
  limit: z.number().int().positive().max(200).optional(),
})

const getPipeline = defineTool({
  name: "get-pipeline",
  description:
    "Return the user's active pipeline — transactions with aggregate value, counts, and overdue flags.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string" },
      limit: { type: "integer" },
    },
  },
  zodSchema: getPipelineSchema,
  handler: async (input, ctx) => {
    const params = new URLSearchParams()
    if (input.status) params.set("status", input.status)
    if (input.limit !== undefined) params.set("limit", String(input.limit))
    const qs = params.toString()
    return forward(
      ctx,
      "GET",
      `/api/transactions${qs ? `?${qs}` : ""}`,
    )
  },
})

// ─── 14. FIND COMPS (stub — /api/data/comps does not yet exist) ─────────────

const findCompsSchema = z.object({
  address: z.string().min(1),
  radiusMiles: z.number().positive().max(10).optional(),
  lookbackMonths: z.number().positive().max(36).optional(),
  minBeds: z.number().int().nonnegative().optional(),
  maxBeds: z.number().int().nonnegative().optional(),
})

const findComps = defineTool({
  name: "find-comps",
  description:
    "Find comparable sales for an address. Currently stubbed — /api/data/comps endpoint not yet implemented; consumer should fall back to run-cma.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      address: { type: "string" },
      radiusMiles: { type: "number" },
      lookbackMonths: { type: "number" },
      minBeds: { type: "integer" },
      maxBeds: { type: "integer" },
    },
    required: ["address"],
  },
  zodSchema: findCompsSchema,
  handler: async (input) => ({
    stubbed: true,
    reason:
      "/api/data/comps not implemented yet. Use run-cma for ensemble pricing + neighborhood context.",
    echo: input,
  }),
})

// ─── 15. LOG FEEDBACK (wraps POST /api/feedback) ────────────────────────────

const logFeedbackSchema = z.object({
  feature: z.string().min(1),
  rating: z.enum(["up", "down"]),
  comment: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

const logFeedback = defineTool({
  name: "log-feedback",
  description:
    "Log user feedback on an AIRE feature — feeds the self-learning engine / circuit breakers.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      feature: { type: "string" },
      rating: { type: "string", enum: ["up", "down"] },
      comment: { type: "string" },
      context: { type: "object" },
    },
    required: ["feature", "rating"],
  },
  zodSchema: logFeedbackSchema,
  handler: async (input, ctx) =>
    forward(ctx, "POST", "/api/feedback", input),
})

// ─── REGISTRY ───────────────────────────────────────────────────────────────

export const tools: ToolDefinition[] = [
  sendUpdate,
  writeContract,
  runCma,
  scanCompliance,
  scheduleVendor,
  classifyDoc,
  sendEnvelope,
  triggerMorningBrief,
  scanEmail,
  createTransaction,
  advanceWorkflow,
  draftReply,
  getPipeline,
  findComps,
  logFeedback,
] as ToolDefinition[]

export function getTool(name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name)
}

// ─── ASSISTANT UI LAYER ─────────────────────────────────────────────────────
// Used by /aire/assistant landing page to display capabilities by category.

export type ToolCategory =
  | "brief"
  | "transactions"
  | "intelligence"
  | "contracts"
  | "airsign"
  | "communications"
  | "compliance"

export const TOOL_CATEGORY_LABEL: Record<ToolCategory, string> = {
  brief: "Morning Brief",
  transactions: "Transactions",
  intelligence: "Market Intelligence",
  contracts: "Contracts",
  airsign: "AirSign",
  communications: "Communications",
  compliance: "Compliance",
}

export interface AssistantTool {
  name: string
  label: string
  description: string
  category: ToolCategory
  confirmRequired?: boolean
}

export const ASSISTANT_TOOLS: AssistantTool[] = [
  { name: "trigger_morning_brief", label: "Morning Brief", description: "Generate or retrieve your morning intelligence brief", category: "brief" },
  { name: "log_feedback", label: "Leave Feedback", description: "Log feedback about an AIRE response or feature", category: "brief" },
  { name: "get_pipeline", label: "Pipeline Overview", description: "View your active transaction pipeline and deal status", category: "transactions" },
  { name: "create_transaction", label: "New Transaction", description: "Create a new real estate transaction", category: "transactions", confirmRequired: true },
  { name: "advance_workflow", label: "Advance Workflow", description: "Advance a transaction to the next workflow stage", category: "transactions", confirmRequired: true },
  { name: "schedule_vendor", label: "Schedule Vendor", description: "Schedule a vendor for an inspection or service", category: "transactions", confirmRequired: true },
  { name: "run_cma", label: "Run CMA", description: "Run a comparative market analysis for a property", category: "intelligence" },
  { name: "find_comps", label: "Find Comps", description: "Find comparable properties near a target address", category: "intelligence" },
  { name: "write_contract", label: "Write Contract", description: "Generate an LREC-compliant real estate contract", category: "contracts", confirmRequired: true },
  { name: "send_envelope", label: "Send for Signature", description: "Create and send an AirSign signature envelope", category: "airsign", confirmRequired: true },
  { name: "send_update", label: "Send Update", description: "Send a communication to a transaction party", category: "communications", confirmRequired: true },
  { name: "draft_reply", label: "Draft Reply", description: "Draft a reply to an email or message", category: "communications" },
  { name: "scan_email", label: "Scan Email", description: "Scan Gmail for deals, deadlines, and action items", category: "communications" },
  { name: "scan_compliance", label: "Compliance Scan", description: "Check a transaction for Louisiana compliance issues", category: "compliance" },
  { name: "classify_doc", label: "Classify Document", description: "Classify and extract data from a real estate document", category: "compliance" },
]
