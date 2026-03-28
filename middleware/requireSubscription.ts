import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

type Tier = "FREE" | "PRO" | "INVESTOR";

// Tier hierarchy for permission checking
const TIER_LEVELS: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  INVESTOR: 2,
};

/**
 * Server-side subscription check.
 * Use in API routes or server components to gate features by tier.
 *
 * Usage:
 *   const { user, tier } = await requireSubscription("PRO");
 */
export async function requireSubscription(requiredTier: Tier = "PRO") {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      tier: null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return {
      error: NextResponse.json({ error: "User not found" }, { status: 404 }),
      user: null,
      tier: null,
    };
  }

  const userLevel = TIER_LEVELS[user.tier as Tier] || 0;
  const requiredLevel = TIER_LEVELS[requiredTier];

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json(
        {
          error: "Subscription required",
          requiredTier,
          currentTier: user.tier,
          upgradeUrl: "/billing",
        },
        { status: 403 }
      ),
      user,
      tier: user.tier as Tier,
    };
  }

  return { error: null, user, tier: user.tier as Tier };
}
