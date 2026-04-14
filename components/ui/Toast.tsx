"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

type ToastKind = "success" | "error" | "info"

interface ToastEntry {
  id: string
  kind: ToastKind
  message: string
  ttl: number
}

interface ToastContextValue {
  show: (kind: ToastKind, message: string, ttl?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_STYLE: Record<ToastKind, { border: string; bg: string; text: string; dot: string }> = {
  success: { border: "#9aab7e66", bg: "#9aab7e22", text: "#9aab7e", dot: "#9aab7e" },
  error: { border: "#d45b5b66", bg: "#d45b5b22", text: "#d45b5b", dot: "#d45b5b" },
  info: { border: "#6b7d5266", bg: "#6b7d5222", text: "#e8e4d8", dot: "#6b7d52" },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (kind: ToastKind, message: string, ttl = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((t) => [...t, { id, kind, message, ttl }])
      const timer = setTimeout(() => remove(id), ttl)
      timers.current.set(id, timer)
    },
    [remove]
  )

  useEffect(() => {
    const snapshot = timers.current
    return () => {
      snapshot.forEach((timer) => clearTimeout(timer))
      snapshot.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 max-w-sm"
      >
        {toasts.map((t) => {
          const style = KIND_STYLE[t.kind]
          return (
            <button
              key={t.id}
              onClick={() => remove(t.id)}
              className="group text-left rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm transition-opacity hover:opacity-90"
              style={{
                border: `1px solid ${style.border}`,
                backgroundColor: style.bg,
                color: style.text,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: style.dot }}
                  aria-hidden="true"
                />
                <span className="text-sm">{t.message}</span>
              </div>
            </button>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Gracefully degrade: return a console-only implementation so components
    // that accidentally render outside the provider don't crash.
    return {
      show: (kind: ToastKind, message: string) => {
        if (typeof window !== "undefined") {
          console.log(`[toast:${kind}] ${message}`)
        }
      },
    }
  }
  return ctx
}
