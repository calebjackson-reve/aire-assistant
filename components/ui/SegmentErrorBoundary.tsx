"use client"

import Link from "next/link"
import { useEffect } from "react"

interface SegmentErrorBoundaryProps {
  error: Error & { digest?: string }
  reset: () => void
  segment: string
  /** Optional secondary route to nudge users back on path. */
  pathForward?: { href: string; label: string }
}

/**
 * Sage-themed fallback for /aire/* segments. Logs the error to the error
 * memory table via /api/learning/errors so patterns surface on the
 * learning dashboard automatically.
 */
export function SegmentErrorBoundary({
  error,
  reset,
  segment,
  pathForward,
}: SegmentErrorBoundaryProps) {
  useEffect(() => {
    // Fire-and-forget error memory log
    fetch("/api/learning/errors/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: `ui:${segment}`,
        errorMessage: error.message || "Unknown UI error",
        context: { digest: error.digest, segment },
      }),
    }).catch(() => {})
  }, [error, segment])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-[#d45b5b]/10 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-[#d45b5b]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-[#6b7d52] text-[10px] tracking-[0.25em] uppercase mb-2">
          {segment}
        </p>
        <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl mb-2">
          Something broke in this view
        </h2>
        <p className="text-[#6a6a60] text-sm mb-6">
          {error.message || "Unexpected error. The team has been notified."}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-[#6b7d52] text-[#f5f2ea] hover:bg-[#5a6c44] transition-colors"
          >
            Try again
          </button>
          {pathForward ? (
            <Link
              href={pathForward.href}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[#6b7d52]/30 text-[#6b7d52] hover:bg-[#9aab7e]/10 transition-colors"
            >
              {pathForward.label}
            </Link>
          ) : (
            <Link
              href="/aire"
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[#6b7d52]/30 text-[#6b7d52] hover:bg-[#9aab7e]/10 transition-colors"
            >
              Back to dashboard
            </Link>
          )}
        </div>
        {error.digest && (
          <p className="mt-4 text-[#6b7d52]/50 text-[10px] font-mono tracking-wider">
            trace: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
