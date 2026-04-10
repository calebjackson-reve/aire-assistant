export default function AireLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6 animate-pulse relative">
      {/* Branded spinner */}
      <div className="absolute top-6 right-6 spinner-aire" />
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
        <div className="h-8 w-24 rounded-lg skeleton-shimmer" />
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-5 space-y-3" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="h-3 w-16 rounded skeleton-shimmer" />
            <div className="h-8 w-24 rounded skeleton-shimmer" />
            <div className="h-2 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Transaction list items */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl border border-[#d4c8b8]/20"
            style={{ animationDelay: `${(i + 4) * 80}ms` }}
          >
            <div className="w-10 h-10 rounded-lg skeleton-shimmer shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded skeleton-shimmer" />
              <div className="h-3 w-32 rounded skeleton-shimmer" />
            </div>
            <div className="h-6 w-20 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}
