"use client"

import { useState } from "react"
import { type AgentStatus } from "@/lib/monitoring/types"

export function ControlPanel({ agents }: { agents: AgentStatus[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function logManualActivity(agentId: string, action: string, msg: string) {
    setLoading(agentId)
    try {
      await fetch("/api/monitoring/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: agentId, action, message: msg }),
      })
      setMessage(`Logged: ${action} for ${agentId}`)
      setTimeout(() => setMessage(""), 3000)
    } catch {
      setMessage("Failed to log activity")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="card-glass !rounded-xl !p-5">
      <p className="text-[#6b7d52] text-[10px] font-medium tracking-[0.15em] uppercase mb-4">
        Agent Controls
      </p>

      <div className="space-y-3">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center justify-between">
            <span className="text-[#1e2416] text-sm">{agent.name}</span>
            <div className="flex gap-2">
              <button
                onClick={() => logManualActivity(agent.id, "phase_complete", `Manual: phase ${agent.phase + 1} complete`)}
                disabled={loading === agent.id || agent.status === "complete"}
                className="text-[10px] px-2.5 py-1 rounded-md bg-[#9aab7e]/15 text-[#6b7d52] hover:bg-[#9aab7e]/25 transition-colors disabled:opacity-30"
              >
                {loading === agent.id ? "..." : "Advance Phase"}
              </button>
              <button
                onClick={() => logManualActivity(agent.id, "error", "Manual error flag")}
                disabled={loading === agent.id}
                className="text-[10px] px-2.5 py-1 rounded-md bg-[#c45c5c]/10 text-[#c45c5c] hover:bg-[#c45c5c]/20 transition-colors disabled:opacity-30"
              >
                Flag Error
              </button>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <p className="text-[#6b7d52] text-xs mt-3 text-center">{message}</p>
      )}
    </div>
  )
}
