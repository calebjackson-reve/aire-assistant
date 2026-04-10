"use client"

export default function AireError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-[#D45B5B]/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#D45B5B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-2xl mb-2">
          Something went wrong
        </h2>
        <p className="text-[#6a6a60] text-sm mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="btn-primary px-6 py-2.5 bg-[#6b7d52] text-[#f5f2ea] rounded-lg text-sm font-medium hover:bg-[#5a6c44] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
