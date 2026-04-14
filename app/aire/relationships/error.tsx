"use client"

import { SegmentErrorBoundary } from "@/components/ui/SegmentErrorBoundary"

export default function relationshipsError({
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
      segment="relationships"
      pathForward={{ href: "/aire", label: "Back to dashboard" }}
    />
  )
}
