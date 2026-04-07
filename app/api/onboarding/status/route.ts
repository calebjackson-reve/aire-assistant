import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/onboarding/status
 * Computes onboarding completion from actual data — not stored checkboxes.
 * This ensures the checklist always reflects reality.
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  href: string;
  tier: "FREE" | "PRO" | "INVESTOR";
  estimatedMinutes: number;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalRequired: number;
  percentComplete: number;
  isComplete: boolean;
  estimatedMinutesRemaining: number;
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      tier: true,
      email: true,
      onboardingData: true,
      _count: {
        select: {
          transactions: true,
          contacts: true,
          emailAccounts: true,
          voiceCommands: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if user has documents uploaded
  const docCount = await prisma.document.count({
    where: { transaction: { userId: user.id } },
  });

  // Check for email accounts
  const hasEmail = user._count.emailAccounts > 0;

  // Check for contacts (vendor roster)
  const hasContacts = user._count.contacts >= 3;

  // Check for transactions (market area configured = has at least 1 transaction)
  const hasTransactions = user._count.transactions > 0;

  // Check for voice commands (voice training)
  const hasVoiceTraining = user._count.voiceCommands >= 3;

  // Profile complete
  const hasProfile = !!(user.firstName && user.lastName);

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Complete Your Profile",
      description: "Add your name and contact information",
      completed: hasProfile,
      required: true,
      href: "/aire/settings",
      tier: "FREE",
      estimatedMinutes: 2,
    },
    {
      id: "gmail",
      title: "Connect Gmail",
      description: "Auto-scan emails for contracts and attachments from title companies",
      completed: hasEmail,
      required: true,
      href: "/aire/onboarding/gmail",
      tier: "PRO",
      estimatedMinutes: 3,
    },
    {
      id: "calendar",
      title: "Connect Google Calendar",
      description: "Sync deadlines, closings, and inspections to your calendar",
      completed: !!(user.onboardingData as Record<string, unknown> | null)?.calendarConnected,
      required: false,
      href: "/aire/onboarding/calendar",
      tier: "PRO",
      estimatedMinutes: 2,
    },
    {
      id: "vendors",
      title: "Set Up Vendor Roster",
      description: "Add your preferred inspectors, appraisers, and title companies",
      completed: hasContacts,
      required: true,
      href: "/aire/onboarding/vendors",
      tier: "FREE",
      estimatedMinutes: 5,
    },
    {
      id: "documents",
      title: "Upload LREC Forms",
      description: "Upload your blank LREC templates so AIRE can auto-fill them",
      completed: docCount >= 3,
      required: true,
      href: "/aire/onboarding/documents",
      tier: "FREE",
      estimatedMinutes: 3,
    },
    {
      id: "market_area",
      title: "Configure Market Area",
      description: "Set your parishes, zip codes, and target neighborhoods",
      completed: hasTransactions, // proxy: if they've created a transaction they know the area
      required: true,
      href: "/aire/onboarding/market-area",
      tier: "FREE",
      estimatedMinutes: 3,
    },
    {
      id: "voice",
      title: "Voice Command Training",
      description: "Try 3 voice commands to calibrate your speech patterns",
      completed: hasVoiceTraining,
      required: false,
      href: "/aire/onboarding/voice",
      tier: "INVESTOR",
      estimatedMinutes: 3,
    },
  ];

  const requiredSteps = steps.filter((s) => s.required);
  const completedRequired = requiredSteps.filter((s) => s.completed).length;
  const completedAll = steps.filter((s) => s.completed).length;
  const remaining = steps
    .filter((s) => !s.completed)
    .reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const status: OnboardingStatus = {
    steps,
    completedCount: completedAll,
    totalRequired: requiredSteps.length,
    percentComplete: Math.round((completedRequired / requiredSteps.length) * 100),
    isComplete: completedRequired === requiredSteps.length,
    estimatedMinutesRemaining: remaining,
  };

  return NextResponse.json(status);
}
