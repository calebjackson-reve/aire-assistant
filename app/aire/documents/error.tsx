"use client"

import { SegmentErrorBoundary } from "@/components/ui/SegmentErrorBoundary"

export default function documentsError({
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
      segment="documents"
      pathForward={{ href: "/aire", label: "Back to dashboard" }}
    />
  )
}
