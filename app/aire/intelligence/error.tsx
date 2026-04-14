"use client"

import { SegmentErrorBoundary } from "@/components/ui/SegmentErrorBoundary"

export default function intelligenceError({
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
      segment="intelligence"
      pathForward={{ href: "/aire", label: "Back to dashboard" }}
    />
  )
}
