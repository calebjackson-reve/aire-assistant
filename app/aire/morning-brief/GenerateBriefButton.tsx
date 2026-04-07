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
        className="bg-[#c19a6b] hover:bg-[#d4a574] text-[#1e2416] text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate Now"}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
