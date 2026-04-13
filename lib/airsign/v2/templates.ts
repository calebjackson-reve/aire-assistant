import prisma from "@/lib/prisma"
import type { AirSignTemplate, Prisma, TemplateKind, TemplateScope } from "@prisma/client"
import { requireBrokeragePermission, getPrimaryMembership } from "./auth"
import { hydrateEnvelope } from "./autofill"

/**
 * Template library CRUD + instantiate-to-envelope.
 *
 * Scope resolution (merged and de-duped at UI layer):
 *   MARKETPLACE  (curated, seeded)
 *   BROKERAGE    (shared across member brokerage)
 *   OFFICE       (shared across a single office within a brokerage)
 *   PERSONAL     (private to one user)
 */

export interface TemplateListOptions {
  kind?: TemplateKind
  folder?: string
  search?: string
}

export interface TemplateFieldSpec {
  type: string
  label?: string
  page: number
  xPct: number
  yPct: number
  wPct: number
  hPct: number
  dataKey?: string
  signerRole?: string
  required?: boolean
  options?: string[]
}

export async function listVisibleTemplates(
  userId: string,
  opts: TemplateListOptions = {}
): Promise<AirSignTemplate[]> {
  const membership = await getPrimaryMembership(userId)
  const brokerageId = membership?.brokerageId ?? null
  const officeId = membership?.teamId ?? null

  const kindFilter = opts.kind ? { kind: opts.kind } : {}
  const folderFilter = opts.folder ? { folder: opts.folder } : {}
  const searchFilter = opts.search
    ? {
        OR: [
          { name: { contains: opts.search, mode: "insensitive" as const } },
          { description: { contains: opts.search, mode: "insensitive" as const } },
          { formCode: { contains: opts.search, mode: "insensitive" as const } },
        ],
      }
    : {}

  const scopeConditions: Prisma.AirSignTemplateWhereInput[] = [
    { scope: "MARKETPLACE" as TemplateScope },
    { scope: "PERSONAL" as TemplateScope, userId },
  ]
  if (brokerageId) scopeConditions.push({ scope: "BROKERAGE" as TemplateScope, brokerageId })
  if (officeId) scopeConditions.push({ scope: "OFFICE" as TemplateScope, officeId })

  return prisma.airSignTemplate.findMany({
    where: { AND: [{ OR: scopeConditions }, kindFilter, folderFilter, searchFilter] },
    orderBy: [{ folder: "asc" }, { name: "asc" }],
  })
}

export interface TemplateCreateInput {
  scope: TemplateScope
  kind: TemplateKind
  name: string
  description?: string
  folder?: string
  tags?: string[]
  brokerageId?: string | null
  officeId?: string | null
  formCode?: string
  pdfBlobUrl?: string
  pageCount?: number
  fieldLayout?: TemplateFieldSpec[] | null
  dataBindings?: Record<string, string> | null
  clauseBody?: string
  taskList?: Array<{ name: string; offsetDays?: number; assignee?: string; required?: boolean }>
}

export async function createTemplate(userId: string, input: TemplateCreateInput): Promise<AirSignTemplate> {
  if (input.scope === "MARKETPLACE") {
    throw new Error("MARKETPLACE templates are seeded, not created by users")
  }

  if (input.scope === "BROKERAGE") {
    if (!input.brokerageId) throw new Error("brokerageId required for BROKERAGE scope")
    await requireBrokeragePermission(userId, input.brokerageId, "template.manage.brokerage")
  } else if (input.scope === "OFFICE") {
    if (!input.brokerageId || !input.officeId) throw new Error("brokerageId + officeId required for OFFICE scope")
    await requireBrokeragePermission(userId, input.brokerageId, "template.manage.office", { officeId: input.officeId })
  }

  return prisma.airSignTemplate.create({
    data: {
      scope: input.scope,
      kind: input.kind,
      name: input.name,
      description: input.description,
      folder: input.folder,
      tags: input.tags ?? [],
      userId: input.scope === "PERSONAL" ? userId : null,
      brokerageId: input.scope === "BROKERAGE" || input.scope === "OFFICE" ? input.brokerageId ?? null : null,
      officeId: input.scope === "OFFICE" ? input.officeId ?? null : null,
      formCode: input.formCode,
      pdfBlobUrl: input.pdfBlobUrl,
      pageCount: input.pageCount,
      fieldLayout: input.fieldLayout as unknown as Prisma.InputJsonValue,
      dataBindings: input.dataBindings as unknown as Prisma.InputJsonValue,
      clauseBody: input.clauseBody,
      taskList: input.taskList as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  patch: Partial<TemplateCreateInput>
): Promise<AirSignTemplate> {
  const existing = await prisma.airSignTemplate.findUnique({ where: { id: templateId } })
  if (!existing) throw new Error("Template not found")
  await assertCanEdit(userId, existing)

  return prisma.airSignTemplate.update({
    where: { id: templateId },
    data: {
      name: patch.name,
      description: patch.description,
      folder: patch.folder,
      tags: patch.tags,
      formCode: patch.formCode,
      pdfBlobUrl: patch.pdfBlobUrl,
      pageCount: patch.pageCount,
      fieldLayout: patch.fieldLayout as unknown as Prisma.InputJsonValue,
      dataBindings: patch.dataBindings as unknown as Prisma.InputJsonValue,
      clauseBody: patch.clauseBody,
      taskList: patch.taskList as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const existing = await prisma.airSignTemplate.findUnique({ where: { id: templateId } })
  if (!existing) return
  await assertCanEdit(userId, existing)
  await prisma.airSignTemplate.delete({ where: { id: templateId } })
}

/**
 * Clone any visible template into the caller's personal scope.
 * Useful for "fork this brokerage template into mine" workflows.
 */
export async function cloneTemplate(
  userId: string,
  templateId: string,
  overrides?: { name?: string; scope?: TemplateScope; brokerageId?: string; officeId?: string }
): Promise<AirSignTemplate> {
  const source = await prisma.airSignTemplate.findUnique({ where: { id: templateId } })
  if (!source) throw new Error("Source template not found")

  const scope = overrides?.scope ?? "PERSONAL"
  const name = overrides?.name ?? `${source.name} (copy)`

  return createTemplate(userId, {
    scope,
    kind: source.kind,
    name,
    description: source.description ?? undefined,
    folder: source.folder ?? undefined,
    tags: source.tags,
    brokerageId: overrides?.brokerageId,
    officeId: overrides?.officeId,
    formCode: source.formCode ?? undefined,
    pdfBlobUrl: source.pdfBlobUrl ?? undefined,
    pageCount: source.pageCount ?? undefined,
    fieldLayout: (source.fieldLayout ?? null) as TemplateFieldSpec[] | null,
    dataBindings: source.dataBindings as Record<string, string> | null,
    clauseBody: source.clauseBody ?? undefined,
    taskList: source.taskList as Array<{ name: string; offsetDays?: number; assignee?: string; required?: boolean }> | undefined,
  })
}

/**
 * Instantiate a DOCUMENT template into a new envelope. Creates the envelope + signers
 * + fields from the template's layout, then hydrates from the transaction's loopData.
 */
export interface InstantiateInput {
  templateId: string
  envelopeName?: string
  transactionId?: string
  signers: Array<{
    name: string
    email: string
    phone?: string
    role?: string
    permission?: "CAN_SIGN" | "FILL_ONLY" | "VIEW_ONLY" | "CC"
    authMethod?: "EMAIL_LINK" | "SMS_OTP" | "ACCESS_CODE" | "KBA"
  }>
  expiresAt?: Date
  customMessage?: string
  bulkSendBatchId?: string
}

export async function instantiateTemplate(userId: string, input: InstantiateInput) {
  const tmpl = await prisma.airSignTemplate.findUnique({ where: { id: input.templateId } })
  if (!tmpl) throw new Error("Template not found")
  if (tmpl.kind !== "DOCUMENT" && tmpl.kind !== "FIELD_SET") {
    throw new Error(`Cannot instantiate template of kind ${tmpl.kind}`)
  }
  if (!tmpl.pdfBlobUrl) throw new Error("Template has no PDF")

  const membership = await getPrimaryMembership(userId)
  const fieldLayout: TemplateFieldSpec[] = Array.isArray(tmpl.fieldLayout)
    ? (tmpl.fieldLayout as unknown as TemplateFieldSpec[])
    : []

  const envelope = await prisma.airSignEnvelope.create({
    data: {
      userId,
      name: input.envelopeName ?? tmpl.name,
      transactionId: input.transactionId ?? null,
      brokerageId: membership?.brokerageId ?? null,
      officeId: membership?.teamId ?? null,
      documentUrl: tmpl.pdfBlobUrl,
      pageCount: tmpl.pageCount,
      templateId: tmpl.id,
      templateInstantiatedAt: new Date(),
      bulkSendBatchId: input.bulkSendBatchId ?? null,
      customMessage: input.customMessage,
      expiresAt: input.expiresAt,
      signers: {
        create: input.signers.map((s, i) => ({
          name: s.name,
          email: s.email,
          phone: s.phone,
          role: s.role ?? "SIGNER",
          order: i + 1,
          signingOrder: i,
          permission: s.permission ?? "CAN_SIGN",
          authMethod: s.authMethod ?? "EMAIL_LINK",
          tokenExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        })),
      },
    },
    include: { signers: true },
  })

  // Materialize template fields on the envelope
  for (const f of fieldLayout) {
    const targetSigner = f.signerRole
      ? envelope.signers.find((s) => s.role === f.signerRole) ?? envelope.signers[0]
      : envelope.signers[0]
    await prisma.airSignField.create({
      data: {
        envelopeId: envelope.id,
        signerId: targetSigner?.id ?? null,
        type: (f.type as never) ?? "SIGNATURE",
        label: f.label ?? null,
        page: f.page ?? 1,
        xPercent: f.xPct ?? 0,
        yPercent: f.yPct ?? 0,
        widthPercent: f.wPct ?? 10,
        heightPercent: f.hPct ?? 3,
        required: f.required ?? true,
        dataKey: f.dataKey ?? null,
        options: (f.options ?? null) as unknown as Prisma.InputJsonValue,
      },
    })
  }

  if (input.transactionId) {
    try {
      await hydrateEnvelope(envelope.id)
    } catch (err) {
      console.error("[airsign-v2] hydrateEnvelope failed during instantiation:", err)
    }
  }

  await prisma.airSignAuditEvent.create({
    data: {
      envelopeId: envelope.id,
      action: "instantiated_from_template",
      metadata: { templateId: tmpl.id, fieldCount: fieldLayout.length },
    },
  })

  return envelope
}

async function assertCanEdit(userId: string, t: AirSignTemplate) {
  if (t.scope === "MARKETPLACE") throw new Error("Cannot edit marketplace template")
  if (t.scope === "PERSONAL") {
    if (t.userId !== userId) throw new Error("Not your template")
    return
  }
  if (t.scope === "BROKERAGE" && t.brokerageId) {
    await requireBrokeragePermission(userId, t.brokerageId, "template.manage.brokerage")
    return
  }
  if (t.scope === "OFFICE" && t.brokerageId) {
    await requireBrokeragePermission(userId, t.brokerageId, "template.manage.office", { officeId: t.officeId })
    return
  }
  throw new Error("Template scope malformed")
}
