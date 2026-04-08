export default function AireLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-sage/20 border-t-sage rounded-full animate-spin" />
        <p className="text-ink-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}
