/**
 * Trial tracking helpers. A trial is active when User.trialEndsAt is in the
 * future. Expiring trials are downgraded back to FREE by `expireTrialIfOver`
 * which is called lazily on the billing and gated-feature code paths.
 */

import prisma from "@/lib/prisma"
import type { User } from "@prisma/client"

export const TRIAL_DAYS = 7

export type TrialStatus = "none" | "active" | "expired"

export interface TrialState {
  status: TrialStatus
  startedAt: Date | null
  endsAt: Date | null
  daysRemaining: number | null
}

export function computeTrialState(user: Pick<User, "trialStartedAt" | "trialEndsAt">): TrialState {
  if (!user.trialStartedAt || !user.trialEndsAt) {
    return { status: "none", startedAt: null, endsAt: null, daysRemaining: null }
  }
  const now = Date.now()
  const ends = user.trialEndsAt.getTime()
  if (ends > now) {
    const daysRemaining = Math.max(0, Math.ceil((ends - now) / 86_400_000))
    return {
      status: "active",
      startedAt: user.trialStartedAt,
      endsAt: user.trialEndsAt,
      daysRemaining,
    }
  }
  return {
    status: "expired",
    startedAt: user.trialStartedAt,
    endsAt: user.trialEndsAt,
    daysRemaining: 0,
  }
}

/**
 * If a user's trial has ended and they are still on PRO/INVESTOR tier
 * without an active Stripe subscription, demote them back to FREE and log
 * a conversion event. Idempotent.
 */
export async function expireTrialIfOver(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      tier: true,
      subscriptionStatus: true,
      trialStartedAt: true,
      trialEndsAt: true,
    },
  })
  if (!user) return
  if (!user.trialEndsAt) return
  if (user.trialEndsAt.getTime() > Date.now()) return

  const hasActiveSub =
    user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing"
  if (hasActiveSub) return
  if (user.tier === "FREE") return

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tier: "FREE" },
    }),
    prisma.conversionEvent.create({
      data: {
        userId,
        event: "trial_expired",
        metadata: { previousTier: user.tier },
      },
    }),
  ])
}

export async function startTrial(userId: string, tier: "PRO" | "INVESTOR", feature?: string) {
  const now = new Date()
  const endsAt = new Date(now.getTime() + TRIAL_DAYS * 86_400_000)

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { trialStartedAt: true },
  })
  // Only grant a trial once — if they've already tried, kick them to checkout.
  if (existing?.trialStartedAt) {
    return { granted: false, reason: "already_used" as const }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      trialStartedAt: now,
      trialEndsAt: endsAt,
      tier,
    },
  })
  await prisma.conversionEvent.create({
    data: { userId, event: "started_trial", tier, feature, metadata: { trialDays: TRIAL_DAYS } },
  })
  return { granted: true as const, endsAt }
}
