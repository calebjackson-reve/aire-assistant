"use client"

// WisprToast — stack of result toasts at bottom-right. Each auto-dismisses
// after 10s. If `undoToken` is present, shows an Undo button for the full
// window. Manual dismiss via the × button.

import { useEffect, useRef, useState } from "react"
import { Check, AlertTriangle, Info, X, Undo2 } from "lucide-react"
import { useWispr } from "./WisprProvider"

export function WisprToastStack() {
  const { toasts, dismissToast, undoAction } = useWispr()

  return (
    <div
      className="fixed z-[55] flex flex-col gap-2"
      style={{
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 148px)",
        maxWidth: "calc(100vw - 32px)",
      }}
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => (
        <ToastRow
          key={t.id}
          toast={t}
          onDismiss={() => dismissToast(t.id)}
          onUndo={t.undoToken ? () => undoAction(t.undoToken as string) : undefined}
        />
      ))}
    </div>
  )
}

function ToastRow({
  toast,
  onDismiss,
  onUndo,
}: {
  toast: Parameters<typeof useWispr>[0] extends never ? never : ReturnType<typeof useWispr>["toasts"][number]
  onDismiss: () => void
  onUndo?: () => void
}) {
  const [undoSecsLeft, setUndoSecsLeft] = useState(10)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!onUndo) return
    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - toast.createdAt) / 1000)
      setUndoSecsLeft(Math.max(0, 10 - elapsed))
    }, 200)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [onUndo, toast.createdAt])

  const Icon =
    toast.tone === "ok" ? Check : toast.tone === "warn" ? AlertTriangle : toast.tone === "error" ? AlertTriangle : Info
  const iconColor =
    toast.tone === "ok"
      ? "#6b7d52"
      : toast.tone === "warn"
        ? "#b5956a"
        : toast.tone === "error"
          ? "#c4787a"
          : "#6b7d52"

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 min-w-[280px] max-w-[440px]"
      style={{
        background: "#f5f2ea",
        color: "#1e2416",
        border: "1px solid rgba(30,36,22,0.12)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 28px rgba(30,36,22,0.22), 0 24px 60px rgba(30,36,22,0.18)",
        fontFamily: "var(--font-body, 'Space Grotesk'), system-ui, sans-serif",
        animation: "wispr-toast-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      }}
    >
      <Icon size={16} strokeWidth={1.75} style={{ color: iconColor, marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-snug" style={{ color: "#1e2416" }}>
          {toast.title}
        </p>
        {toast.detail && (
          <p className="text-[12px] mt-1 leading-snug" style={{ color: "rgba(30,36,22,0.55)" }}>
            {toast.detail}
          </p>
        )}
        {onUndo && undoSecsLeft > 0 && (
          <button
            type="button"
            onClick={onUndo}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-md transition-colors"
            style={{
              color: "#6b7d52",
              border: "1px solid rgba(107,125,82,0.35)",
              background: "transparent",
              fontFamily: "var(--font-body)",
            }}
          >
            <Undo2 size={12} strokeWidth={1.75} />
            Undo · {undoSecsLeft}s
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-md hover:bg-[#e8e4d8] transition-colors"
      >
        <X size={14} strokeWidth={1.75} style={{ color: "rgba(30,36,22,0.5)" }} />
      </button>
      <style>{`
        @keyframes wispr-toast-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
