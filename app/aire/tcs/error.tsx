"use client"

import { SegmentErrorBoundary } from "@/components/ui/SegmentErrorBoundary"

export default function tcsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <SegmentErrorBoundary
      error={error}
      reset={reset}
      segment="tcs"
      pathForward={{ href: "/aire", label: "Back to dashboard" }}
    />
  )
}
