"use client"

import { useEffect, useState } from "react"

type Activity = {
  id: string
  agent: string
  action: string
  message: string
  severity: "info" | "warn" | "error" | string
  createdAt: string
}

type Status = "idle" | "running" | "error"

type Props = {
  pollMs?: number
  recentWindowMs?: number
}

export function AgentPulseChip({ pollMs = 10_000, recentWindowMs = 45_000 }: Props) {
  const [status, setStatus] = useState<Status>("idle")
  const [latest, setLatest] = useState<Activity | null>(null)

  useEffect(() => {
    let stopped = false
    const controller = new AbortController()

    async function tick() {
      try {
        const res = await fetch("/api/monitoring/activity?limit=1", {
          cache: "no-store",
          signal: controller.signal,
        })
        if (!res.ok || stopped) return
        const data = (await res.json()) as { activities?: Activity[] }
        const top = data.activities?.[0]
        if (!top) {
          setStatus("idle")
          return
        }
        setLatest(top)
        const age = Date.now() - new Date(top.createdAt).getTime()
        if (top.severity === "error" && age < recentWindowMs) setStatus("error")
        else if (age < recentWindowMs) setStatus("running")
        else setStatus("idle")
      } catch {
        // silent — offline/stopped
      }
    }

    tick()
    const interval = setInterval(tick, pollMs)
    return () => {
      stopped = true
      controller.abort()
      clearInterval(interval)
    }
  }, [pollMs, recentWindowMs])

  const ringColor =
    status === "error" ? "#c4787a" : status === "running" ? "#9aab7e" : "rgba(179,194,149,0.55)"
  const pulsing = status === "running" || status === "error"
  const label =
    status === "error"
      ? "Agent error"
      : status === "running"
        ? truncate(latest?.agent ?? "Agent", 20)
        : "All agents idle"

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-3.5 py-1.5 backdrop-blur-sm"
      style={{
        background: "rgba(30,36,22,0.55)",
        border: "1px solid rgba(154,171,126,0.28)",
        boxShadow: "inset 0 1px 0 rgba(245,242,234,0.06)",
      }}
    >
      <span className="relative inline-flex w-4 h-4 items-center justify-center">
        <span
          className="relative z-10 w-1.5 h-1.5 rounded-full"
          style={{ background: ringColor }}
        />
        {pulsing && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: ringColor,
                opacity: 0.35,
                animation: "aireAgentPulse 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: ringColor,
                opacity: 0.25,
                animation: "aireAgentPulse 2.4s cubic-bezier(0.34,1.56,0.64,1) infinite 1.2s",
              }}
            />
          </>
        )}
      </span>

      <span
        className="text-[10px] uppercase tracking-[0.18em] truncate max-w-[240px]"
        style={{
          fontFamily: "var(--font-ibm-mono)",
          color: status === "idle" ? "rgba(232,228,216,0.55)" : "rgba(232,228,216,0.85)",
        }}
      >
        {label}
      </span>

      <style>{`
        @keyframes aireAgentPulse {
          0%   { transform: scale(0.8); opacity: 0.45; }
          70%  { transform: scale(2.8); opacity: 0; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}
