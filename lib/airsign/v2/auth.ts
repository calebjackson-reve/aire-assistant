import prisma from "@/lib/prisma"
import type { BrokerageRole } from "@prisma/client"

/**
 * Brokerage permission matrix for AirSign v2.
 *
 * Every action that touches brokerage-scoped data (templates, envelopes, reviews,
 * analytics, settings) must call requireBrokeragePermission() before reading/writing.
 *
 * Role precedence (inclusive permissions):
 *   BROKER_OWNER > COMPLIANCE_OFFICER > OFFICE_ADMIN > AGENT > ASSISTANT
 */

export type BrokeragePermission =
  | "envelope.read.own"
  | "envelope.read.office"
  | "envelope.read.brokerage"
  | "envelope.submit_for_review"
  | "envelope.approve_review"
  | "envelope.reject_review"
  | "template.manage.personal"
  | "template.manage.office"
  | "template.manage.brokerage"
  | "member.invite"
  | "member.remove"
  | "branding.edit"
  | "settings.edit"
  | "compliance.export"
  | "bulk_send.create"
  | "loop_import.create"

/**
 * BrokerageMember.role is a free-text String in the legacy schema. Normalize it to
 * the canonical BrokerageRole enum.
 *   "OWNER" | "BROKER"     -> BROKER_OWNER
 *   "TC" | "COMPLIANCE"    -> COMPLIANCE_OFFICER
 *   "OFFICE_ADMIN"/"ADMIN" -> OFFICE_ADMIN
 *   "AGENT"                -> AGENT
 *   "ASSISTANT"            -> ASSISTANT
 */
export function normalizeRole(raw: string | null | undefined): BrokerageRole {
  const v = (raw || "AGENT").toUpperCase()
  if (v === "OWNER" || v === "BROKER" || v === "BROKER_OWNER") return "BROKER_OWNER"
  if (v === "TC" || v === "COMPLIANCE" || v === "COMPLIANCE_OFFICER") return "COMPLIANCE_OFFICER"
  if (v === "OFFICE_ADMIN" || v === "ADMIN") return "OFFICE_ADMIN"
  if (v === "ASSISTANT") return "ASSISTANT"
  return "AGENT"
}

const ALLOW: Record<BrokerageRole, BrokeragePermission[]> = {
  BROKER_OWNER: [
    "envelope.read.own", "envelope.read.office", "envelope.read.brokerage",
    "envelope.submit_for_review", "envelope.approve_review", "envelope.reject_review",
    "template.manage.personal", "template.manage.office", "template.manage.brokerage",
    "member.invite", "member.remove", "branding.edit", "settings.edit", "compliance.export",
    "bulk_send.create", "loop_import.create",
  ],
  COMPLIANCE_OFFICER: [
    "envelope.read.own", "envelope.read.office", "envelope.read.brokerage",
    "envelope.submit_for_review", "envelope.approve_review", "envelope.reject_review",
    "template.manage.personal", "template.manage.office", "template.manage.brokerage",
    "compliance.export", "bulk_send.create", "loop_import.create",
  ],
  OFFICE_ADMIN: [
    "envelope.read.own", "envelope.read.office",
    "envelope.submit_for_review",
    "template.manage.personal", "template.manage.office",
    "member.invite",
    "bulk_send.create", "loop_import.create",
  ],
  AGENT: [
    "envelope.read.own",
    "envelope.submit_for_review",
    "template.manage.personal",
    "bulk_send.create", "loop_import.create",
  ],
  ASSISTANT: [
    "envelope.read.own",
    "template.manage.personal",
  ],
}

export async function getMembership(userId: string, brokerageId: string) {
  const member = await prisma.brokerageMember.findFirst({ where: { userId, brokerageId } })
  if (!member) return null
  return { ...member, roleEnum: normalizeRole(member.role) }
}

/** User's single (legacy-shaped) brokerage membership. Null = personal user. */
export async function getPrimaryMembership(userId: string) {
  const member = await prisma.brokerageMember.findUnique({ where: { userId } })
  if (!member) return null
  return { ...member, roleEnum: normalizeRole(member.role) }
}

export class BrokeragePermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BrokeragePermissionError"
  }
}

/**
 * Throws if the user cannot perform `action` in `brokerageId`.
 * Pass `officeId` when the action is office-scoped; office-admins must match their own office.
 */
export async function requireBrokeragePermission(
  userId: string,
  brokerageId: string,
  action: BrokeragePermission,
  opts?: { officeId?: string | null }
) {
  const member = await getMembership(userId, brokerageId)
  if (!member) throw new BrokeragePermissionError("Not a member of this brokerage")

  const allowed = ALLOW[member.roleEnum]
  if (!allowed.includes(action)) {
    throw new BrokeragePermissionError(`Role ${member.roleEnum} cannot perform ${action}`)
  }

  if (member.roleEnum === "OFFICE_ADMIN" && opts?.officeId && member.teamId !== opts.officeId) {
    throw new BrokeragePermissionError("Office-admin role can only act within assigned office")
  }

  return member
}

export function envelopeReadScope(role: BrokerageRole): "own" | "office" | "brokerage" {
  if (role === "BROKER_OWNER" || role === "COMPLIANCE_OFFICER") return "brokerage"
  if (role === "OFFICE_ADMIN") return "office"
  return "own"
}
