"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function GenerateBriefButton() {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/morning-brief/generate", {
        method: "POST",
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to generate brief")
      }
    } catch {
      setError("Network error")
    }
    setGenerating(false)
  }

  return (
    <div className="mt-4">
      <button
        onClick={generate}
        disabled={generating}
        style={{ transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1), opacity 150ms ease" }}
        className="bg-[#6b7d52] text-[#f5f2ea] text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e]/50"
      >
        {generating ? "Generating..." : "Generate Now"}
      </button>
      {error && <p className="text-[#8b4a4a] text-sm mt-2">{error}</p>}
    </div>
  )
}
