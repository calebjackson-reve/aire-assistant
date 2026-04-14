"use client"

import { SegmentErrorBoundary } from "@/components/ui/SegmentErrorBoundary"

export default function system_statusError({
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
      segment="system-status"
      pathForward={{ href: "/aire", label: "Back to dashboard" }}
    />
  )
}
