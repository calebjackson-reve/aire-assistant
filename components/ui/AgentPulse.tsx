// AgentPulse — C1 component
// 48px sage ring that pulses when any cron/agent is running.
// Drives animation via CSS keyframes on data-active; reduced-motion safe.
// Usage: <AgentPulse active={isRunning} label="Morning Brief" size={48} />

const KEYFRAMES = `
@keyframes agent-pulse-ring {
  0%   { transform: scale(1);    opacity: 0.7; }
  60%  { transform: scale(1.45); opacity: 0;   }
  100% { transform: scale(1.45); opacity: 0;   }
}
@keyframes agent-pulse-dot {
  0%, 100% { transform: scale(1);    }
  50%       { transform: scale(0.92); }
}
.agent-pulse-ring[data-active="true"] {
  animation: agent-pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
.agent-pulse-dot[data-active="true"] {
  animation: agent-pulse-dot 1.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .agent-pulse-ring, .agent-pulse-dot { animation: none !important; }
}
`

interface AgentPulseProps {
  active?: boolean
  size?: number
  label?: string
  className?: string
}

export function AgentPulse({ active = false, size = 48, label, className = "" }: AgentPulseProps) {
  const dotSize = Math.round(size * 0.375) // inner dot = 18px at 48px
  const inset = Math.round((size - dotSize) / 2)

  return (
    <span
      className={`relative inline-flex items-center gap-2.5 ${className}`}
      role="status"
      aria-label={label ? `${label}: ${active ? "running" : "idle"}` : active ? "Agent running" : "Agent idle"}
    >
      <style>{KEYFRAMES}</style>

      {/* Container */}
      <span className="relative" style={{ width: size, height: size, flexShrink: 0 }}>
        {/* Expanding ring — only visible when active */}
        <span
          className="agent-pulse-ring absolute inset-0 rounded-full"
          data-active={String(active)}
          style={{
            background: "transparent",
            border: `2px solid #9aab7e`,
            opacity: active ? 0.7 : 0,
            transformOrigin: "center",
          }}
        />

        {/* Inner dot */}
        <span
          className="agent-pulse-dot absolute rounded-full"
          data-active={String(active)}
          style={{
            top: inset,
            left: inset,
            width: dotSize,
            height: dotSize,
            background: active ? "#9aab7e" : "rgba(154,171,126,0.25)",
            boxShadow: active
              ? "0 0 0 2px rgba(154,171,126,0.18), 0 2px 8px rgba(30,36,22,0.18)"
              : "none",
            transition: "background 300ms ease, box-shadow 300ms ease",
            transformOrigin: "center",
          }}
        />
      </span>

      {/* Optional label */}
      {label && (
        <span
          className="font-mono text-[11px] uppercase tracking-[0.1em]"
          style={{ color: active ? "#9aab7e" : "rgba(154,171,126,0.45)" }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
