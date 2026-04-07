import { NextResponse } from "next/server";
import { getUserTier, getFeatureMatrix, checkFeatureAccess, type Feature } from "@/lib/auth/subscription-gate";

/**
 * GET /api/billing/feature-matrix
 * Returns the feature matrix with the user's current access status for each feature.
 */
export async function GET() {
  const userInfo = await getUserTier();
  const matrix = getFeatureMatrix();

  const features: Record<string, {
    allowed: boolean;
    minTier: string;
    description: string;
    freeLimit?: number;
    currentUsage?: number;
  }> = {};

  for (const [key, rule] of Object.entries(matrix)) {
    const result = await checkFeatureAccess(key as Feature);
    features[key] = {
      allowed: result.allowed,
      minTier: rule.minTier,
      description: rule.description,
      freeLimit: rule.freeLimit,
      currentUsage: result.currentUsage,
    };
  }

  return NextResponse.json({
    currentTier: userInfo?.tier || "FREE",
    features,
  });
}
