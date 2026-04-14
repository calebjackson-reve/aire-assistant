import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { startTrial, TRIAL_DAYS } from "@/lib/billing/trial"
import { createCheckoutSession } from "@/lib/stripe"

export const dynamic = "force-dynamic"

/**
 * POST /api/billing/trial
 * Body: { tier: "PRO" | "INVESTOR", feature?: string }
 *
 * Behavior:
 *  - If user has never trialed: grant trial locally (7 days), then hand back a
 *    Stripe checkout URL with trial_period_days so the subscription is ready to
 *    auto-convert at the end. We also mark the user as PRO/INVESTOR immediately
 *    so gated features unlock.
 *  - If user has already used a trial: return { url: checkout without trial }.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    tier?: "PRO" | "INVESTOR"
    feature?: string
  }
  const tier = body.tier === "INVESTOR" ? "INVESTOR" : "PRO"

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const priceId =
    tier === "INVESTOR"
      ? process.env.STRIPE_INVESTOR_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID

  const trialResult = await startTrial(user.id, tier, body.feature)

  // Try to create a Stripe checkout with trial_period_days so the subscription
  // can auto-convert when the local trial ends. Fall back to returning a
  // trial-only response if Stripe isn't configured so /aire keeps working.
  if (priceId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await createCheckoutSession({
        userId: user.id,
        email: user.email,
        priceId,
        customerId: user.stripeCustomerId ?? undefined,
        trialDays: trialResult.granted ? TRIAL_DAYS : undefined,
      })
      return NextResponse.json({
        trialGranted: trialResult.granted,
        url: session.url,
        trialDays: TRIAL_DAYS,
      })
    } catch (err) {
      console.error("Trial checkout error:", err)
      return NextResponse.json({
        trialGranted: trialResult.granted,
        url: null,
        trialDays: TRIAL_DAYS,
        note: "Trial started locally — add a payment method at /billing to avoid interruption.",
      })
    }
  }

  return NextResponse.json({
    trialGranted: trialResult.granted,
    url: null,
    trialDays: TRIAL_DAYS,
    note: "Trial started locally. Stripe not fully configured in this environment.",
  })
}
