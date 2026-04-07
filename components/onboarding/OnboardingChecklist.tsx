"use client";

import { useState, useEffect } from "react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
  href: string;
  tier: string;
  estimatedMinutes: number;
}

interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  totalRequired: number;
  percentComplete: number;
  isComplete: boolean;
  estimatedMinutesRemaining: number;
}

interface OnboardingChecklistProps {
  /** Compact mode for dashboard sidebar widget */
  compact?: boolean;
}

export default function OnboardingChecklist({ compact = false }: OnboardingChecklistProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("aire_onboarding_dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
      setLoading(false);
      return;
    }

    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        if (data.isComplete) setDismissed(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || dismissed || !status) return null;

  const handleDismiss = () => {
    localStorage.setItem("aire_onboarding_dismissed", "true");
    setDismissed(true);
  };

  // Compact mode: progress bar + next step only
  if (compact) {
    const nextStep = status.steps.find((s) => !s.completed && s.required);
    return (
      <div className="bg-white border border-[#e8e4d8] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#6b7d52] uppercase tracking-wider">
            Setup Progress
          </span>
          <span className="text-xs text-gray-400">
            {status.percentComplete}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
          <div
            className="bg-[#6b7d52] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${status.percentComplete}%` }}
          />
        </div>
        {nextStep && (
          <a
            href={nextStep.href}
            className="flex items-center gap-2 text-sm text-[#1e2416] hover:text-[#6b7d52] transition-colors"
          >
            <span className="w-5 h-5 rounded-full border-2 border-[#9aab7e] flex items-center justify-center text-xs">
              {status.completedCount + 1}
            </span>
            <span className="font-medium">{nextStep.title}</span>
            <span className="text-xs text-gray-400 ml-auto">
              ~{nextStep.estimatedMinutes}min
            </span>
          </a>
        )}
      </div>
    );
  }

  // Full checklist
  return (
    <div className="bg-white border border-[#e8e4d8] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#9aab7e] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-lg font-bold text-[#f5f2ea]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Get Started with AIRE
            </h2>
            <p className="text-sm text-[#f5f2ea]/80 mt-0.5">
              {status.estimatedMinutesRemaining > 0
                ? `~${status.estimatedMinutesRemaining} minutes remaining`
                : "You're all set!"}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[#f5f2ea]/60 hover:text-[#f5f2ea] text-sm"
          >
            Dismiss
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-3 w-full bg-[#f5f2ea]/20 rounded-full h-2">
          <div
            className="bg-[#f5f2ea] h-2 rounded-full transition-all duration-500"
            style={{ width: `${status.percentComplete}%` }}
          />
        </div>
        <p className="text-xs text-[#f5f2ea]/70 mt-1">
          {status.completedCount} of {status.steps.length} steps complete
        </p>
      </div>

      {/* Steps */}
      <div className="divide-y divide-[#e8e4d8]">
        {status.steps.map((step, idx) => (
          <a
            key={step.id}
            href={step.completed ? undefined : step.href}
            className={`flex items-start gap-4 px-6 py-4 transition-colors ${
              step.completed
                ? "opacity-60"
                : "hover:bg-[#f5f2ea]/50 cursor-pointer"
            }`}
          >
            {/* Step indicator */}
            <div className="mt-0.5 flex-shrink-0">
              {step.completed ? (
                <div className="w-6 h-6 rounded-full bg-[#6b7d52] flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-[#e8e4d8] flex items-center justify-center text-xs text-gray-400 font-medium">
                  {idx + 1}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    step.completed
                      ? "text-gray-400 line-through"
                      : "text-[#1e2416]"
                  }`}
                >
                  {step.title}
                </span>
                {!step.required && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px] font-medium">
                    OPTIONAL
                  </span>
                )}
                {step.tier !== "FREE" && (
                  <span className="px-1.5 py-0.5 bg-[#9aab7e]/15 text-[#6b7d52] rounded text-[10px] font-medium">
                    {step.tier}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {step.description}
              </p>
            </div>

            {/* Time estimate */}
            {!step.completed && (
              <span className="text-xs text-gray-300 whitespace-nowrap mt-1">
                ~{step.estimatedMinutes}min
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
