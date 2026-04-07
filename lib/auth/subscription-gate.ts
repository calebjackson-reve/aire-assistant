/**
 * AIRE Subscription Tier Gate
 *
 * Enforces feature access based on user's subscription tier.
 * Use in API routes and server components to block unauthorized access.
 *
 * Tiers: FREE → PRO ($47/mo) → INVESTOR ($147/mo)
 */

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import type { Tier } from "@prisma/client";

// ─── Tier Hierarchy ────────────────────────────────────────────

const TIER_LEVEL: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  INVESTOR: 2,
};

// ─── Feature Definitions ───────────────────────────────────────

export type Feature =
  | "transactions"
  | "tc_agent"
  | "document_intelligence"
  | "document_upload"
  | "morning_brief"
  | "voice_commands"
  | "cma_engine"
  | "api_access"
  | "email_scanning"
  | "relationship_intelligence"
  | "airsign"
  | "batch_upload"
  | "compliance_scan";

interface FeatureRule {
  minTier: Tier;
  freeLimit?: number; // e.g., 3 transactions for FREE tier
  description: string;
}

const FEATURE_GATES: Record<Feature, FeatureRule> = {
  transactions:               { minTier: "FREE",     freeLimit: 3,  description: "Transaction management" },
  document_upload:            { minTier: "FREE",     freeLimit: 10, description: "Document upload" },
  tc_agent:                   { minTier: "PRO",                     description: "TC automation agent" },
  document_intelligence:      { minTier: "PRO",                     description: "AI document classification & extraction" },
  morning_brief:              { minTier: "PRO",                     description: "Daily morning brief" },
  email_scanning:             { minTier: "PRO",                     description: "Gmail attachment scanning" },
  relationship_intelligence:  { minTier: "PRO",                     description: "Relationship intelligence scoring" },
  airsign:                    { minTier: "PRO",                     description: "Electronic signatures" },
  batch_upload:               { minTier: "PRO",                     description: "Multi-file batch upload" },
  compliance_scan:            { minTier: "PRO",                     description: "Compliance checking" },
  voice_commands:             { minTier: "INVESTOR",                description: "Voice command pipeline" },
  cma_engine:                 { minTier: "INVESTOR",                description: "CMA & AIRE Estimate engine" },
  api_access:                 { minTier: "INVESTOR",                description: "External API access" },
};

// ─── Gate Result ───────────────────────────────────────────────

export interface GateResult {
  allowed: boolean;
  tier: Tier;
  requiredTier: Tier;
  feature: Feature;
  reason?: string;
  limit?: number;
  currentUsage?: number;
}

// ─── Core Gate Function ────────────────────────────────────────

/**
 * Check if the current authenticated user has access to a feature.
 * Returns GateResult with allowed/denied + reason.
 */
export async function checkFeatureAccess(feature: Feature): Promise<GateResult> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return {
      allowed: false,
      tier: "FREE",
      requiredTier: FEATURE_GATES[feature].minTier,
      feature,
      reason: "Not authenticated",
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      tier: true,
      subscriptionStatus: true,
      _count: { select: { transactions: true } },
    },
  });

  if (!user) {
    return {
      allowed: false,
      tier: "FREE",
      requiredTier: FEATURE_GATES[feature].minTier,
      feature,
      reason: "User not found",
    };
  }

  // Past-due subscriptions get downgraded to FREE access
  const effectiveTier: Tier =
    user.subscriptionStatus === "past_due" ? "FREE" : user.tier;

  const rule = FEATURE_GATES[feature];
  const userLevel = TIER_LEVEL[effectiveTier];
  const requiredLevel = TIER_LEVEL[rule.minTier];

  // Tier check
  if (userLevel < requiredLevel) {
    return {
      allowed: false,
      tier: effectiveTier,
      requiredTier: rule.minTier,
      feature,
      reason: `${rule.description} requires ${rule.minTier} tier or above`,
    };
  }

  // Free tier limit check
  if (effectiveTier === "FREE" && rule.freeLimit !== undefined) {
    const usage = feature === "transactions"
      ? user._count.transactions
      : feature === "document_upload"
        ? await prisma.document.count({ where: { transaction: { userId: user.id } } })
        : 0;

    if (usage >= rule.freeLimit) {
      return {
        allowed: false,
        tier: effectiveTier,
        requiredTier: "PRO",
        feature,
        reason: `Free tier limit reached (${usage}/${rule.freeLimit}). Upgrade to PRO for unlimited.`,
        limit: rule.freeLimit,
        currentUsage: usage,
      };
    }
  }

  return {
    allowed: true,
    tier: effectiveTier,
    requiredTier: rule.minTier,
    feature,
  };
}

// ─── Convenience: Require Feature (throws/returns 403) ─────────

/**
 * Use in API routes. Returns null if allowed, or a NextResponse 403 if blocked.
 */
export async function requireFeature(feature: Feature) {
  const result = await checkFeatureAccess(feature);
  if (result.allowed) return null;

  const { NextResponse } = await import("next/server");
  return NextResponse.json(
    {
      error: "Upgrade required",
      feature,
      requiredTier: result.requiredTier,
      currentTier: result.tier,
      reason: result.reason,
      limit: result.limit,
      currentUsage: result.currentUsage,
    },
    { status: 403 }
  );
}

// ─── Get User Tier (lightweight) ───────────────────────────────

export async function getUserTier(): Promise<{ tier: Tier; userId: string } | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, tier: true, subscriptionStatus: true },
  });

  if (!user) return null;

  const effectiveTier: Tier =
    user.subscriptionStatus === "past_due" ? "FREE" : user.tier;

  return { tier: effectiveTier, userId: user.id };
}

// ─── Feature Matrix (for UI rendering) ─────────────────────────

export function getFeatureMatrix(): Record<Feature, { minTier: Tier; description: string; freeLimit?: number }> {
  return Object.fromEntries(
    Object.entries(FEATURE_GATES).map(([key, rule]) => [
      key,
      { minTier: rule.minTier, description: rule.description, freeLimit: rule.freeLimit },
    ])
  ) as Record<Feature, { minTier: Tier; description: string; freeLimit?: number }>;
}
