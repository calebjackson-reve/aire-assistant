import prisma from "@/lib/prisma"
import type { BrokerageAirSignSettings, Brokerage, ComplianceMode, SignerAuthMethod } from "@prisma/client"

/**
 * Resolves effective AirSign settings for a brokerage.
 *
 * Preferred source: BrokerageAirSignSettings (dedicated v2 extension table).
 * Fallback: legacy fields directly on Brokerage (accentColor, emailFooter,
 * defaultSignerAuth, requireReview) so environments without the new table
 * still get sane defaults.
 */

export interface ResolvedBrandingSettings {
  logoUrl?: string
  accentColor?: string
  emailFooter?: string
  fontFamily?: string
  wordmark?: string
}

export interface ResolvedBrokerageSettings {
  id: string | null                 // BrokerageAirSignSettings.id, null if falling back to Brokerage
  branding: ResolvedBrandingSettings
  defaultSignerAuth: SignerAuthMethod
  requireSignerAuth: boolean
  complianceMode: ComplianceMode
  certificateTemplate?: string
}

interface BrandingShape {
  logoUrl?: unknown
  accentColor?: unknown
  emailFooter?: unknown
  fontFamily?: unknown
  wordmark?: unknown
}

export function parseBranding(json: unknown): ResolvedBrandingSettings {
  if (!json || typeof json !== "object") return {}
  const b = json as BrandingShape
  return {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : undefined,
    accentColor: typeof b.accentColor === "string" ? b.accentColor : undefined,
    emailFooter: typeof b.emailFooter === "string" ? b.emailFooter : undefined,
    fontFamily: typeof b.fontFamily === "string" ? b.fontFamily : undefined,
    wordmark: typeof b.wordmark === "string" ? b.wordmark : undefined,
  }
}

/** Effective settings for a given brokerage. Never throws — always returns a shape. */
export async function resolveBrokerageSettings(brokerageId: string): Promise<ResolvedBrokerageSettings> {
  const [settings, brokerage] = await Promise.all([
    prisma.brokerageAirSignSettings.findUnique({ where: { brokerageId } }),
    prisma.brokerage.findUnique({ where: { id: brokerageId } }),
  ])

  if (settings) {
    const brandingFromJson = parseBranding(settings.brandingJson)
    const brandingFromBrokerage: ResolvedBrandingSettings = {
      logoUrl: brokerage?.logoUrl ?? undefined,
      accentColor: brokerage?.accentColor ?? undefined,
      emailFooter: brokerage?.emailFooter ?? undefined,
    }
    return {
      id: settings.id,
      branding: { ...brandingFromBrokerage, ...brandingFromJson },
      defaultSignerAuth: settings.defaultSignerAuth,
      requireSignerAuth: settings.requireSignerAuth,
      complianceMode: settings.complianceMode,
      certificateTemplate: settings.certificateTemplate ?? undefined,
    }
  }

  // Fallback to legacy Brokerage fields
  return {
    id: null,
    branding: {
      logoUrl: brokerage?.logoUrl ?? undefined,
      accentColor: brokerage?.accentColor ?? undefined,
      emailFooter: brokerage?.emailFooter ?? undefined,
    },
    defaultSignerAuth: (brokerage?.defaultSignerAuth as SignerAuthMethod) ?? "EMAIL_LINK",
    requireSignerAuth: false,
    complianceMode: brokerage?.requireReview ? "REVIEW_BEFORE_SEND" : "OFF",
  }
}

/**
 * Upsert settings. Creates the BrokerageAirSignSettings row if missing.
 * Returns the canonical ResolvedBrokerageSettings for rendering.
 */
export async function upsertSettings(
  brokerageId: string,
  patch: {
    branding?: ResolvedBrandingSettings
    defaultSignerAuth?: SignerAuthMethod
    requireSignerAuth?: boolean
    complianceMode?: ComplianceMode
    certificateTemplate?: string | null
  }
): Promise<BrokerageAirSignSettings> {
  const existing = await prisma.brokerageAirSignSettings.findUnique({ where: { brokerageId } })
  const mergedBranding = { ...parseBranding(existing?.brandingJson), ...(patch.branding ?? {}) }

  return prisma.brokerageAirSignSettings.upsert({
    where: { brokerageId },
    create: {
      brokerageId,
      brandingJson: mergedBranding as object,
      defaultSignerAuth: patch.defaultSignerAuth ?? "EMAIL_LINK",
      requireSignerAuth: patch.requireSignerAuth ?? false,
      complianceMode: patch.complianceMode ?? "OFF",
      certificateTemplate: patch.certificateTemplate,
    },
    update: {
      brandingJson: mergedBranding as object,
      defaultSignerAuth: patch.defaultSignerAuth,
      requireSignerAuth: patch.requireSignerAuth,
      complianceMode: patch.complianceMode,
      certificateTemplate: patch.certificateTemplate,
    },
  })
}

/** Snapshot current settings into the envelope for branding stability after send. */
export async function snapshotSettingsForEnvelope(envelopeId: string, brokerageId: string | null) {
  if (!brokerageId) return null
  let settings = await prisma.brokerageAirSignSettings.findUnique({ where: { brokerageId } })
  if (!settings) {
    // Materialize a BrokerageAirSignSettings row from the Brokerage fallback so we have a stable snapshot id
    const brokerage = await prisma.brokerage.findUnique({ where: { id: brokerageId } })
    if (!brokerage) return null
    settings = await prisma.brokerageAirSignSettings.create({
      data: {
        brokerageId,
        brandingJson: {
          logoUrl: brokerage.logoUrl ?? undefined,
          accentColor: brokerage.accentColor ?? undefined,
          emailFooter: brokerage.emailFooter ?? undefined,
        } as object,
        defaultSignerAuth: (brokerage.defaultSignerAuth as SignerAuthMethod) ?? "EMAIL_LINK",
        complianceMode: brokerage.requireReview ? "REVIEW_BEFORE_SEND" : "OFF",
      },
    })
  }
  await prisma.airSignEnvelope.update({
    where: { id: envelopeId },
    data: { brokerageSettingsId: settings.id },
  })
  return settings
}

export type BrokerageWithOptionalSettings = Brokerage & {
  airSignSettings: BrokerageAirSignSettings | null
}
