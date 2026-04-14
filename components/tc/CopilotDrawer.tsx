"use client"

/**
 * AIRE AI Copilot Drawer
 * Right-rail slide-in panel with streaming Claude chat, pre-loaded with deal context.
 * Opens via a trigger button in TransactionDetail's right sidebar.
 *
 * Motion: translateX(100% → 0) + opacity(0 → 1), spring 320ms
 * Theme: Nocturne (Deep Forest canvas, Linen text) to match /aire/* default
 */

import { useState, useRef, useEffect, useCallback } from "react"
import { MessageSquare, X, Send, Sparkles } from "lucide-react"

interface DealContext {
  address: string
  city: string
  state: string
  status: string
  buyerName?: string | null
  sellerName?: string | null
  acceptedPrice?: number | null
  closingDate?: string | null
  contractDate?: string | null
  overdueDeadlines: number
  upcomingDeadlines: number
  documentCount: number
}

interface Message {
  role: "user" | "assistant"
  content: string
}

interface CopilotDrawerProps {
  context: DealContext
  isOpen: boolean
  onClose: () => void
}

const SUGGESTED_PROMPTS = [
  "What's the biggest risk in this deal right now?",
  "Draft a closing reminder email for the buyer",
  "What disclosures are required in Louisiana?",
  "What happens if we miss the inspection deadline?",
]

export function CopilotDrawer({ context, isOpen, onClose }: CopilotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 320)
    }
  }, [isOpen])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return
    setError(null)

    const userMsg: Message = { role: "user", content: text.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput("")
    setIsStreaming(true)

    // Append empty assistant message that will fill via stream
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: nextMessages, context }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error("No response body")

      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (raw === "[DONE]") break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: last.content + parsed.text }
                }
                return updated
              })
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      // Remove the empty assistant placeholder
      setMessages(prev => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.content === "") updated.pop()
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, context, isStreaming])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1e2416]/60 lg:hidden"
          style={{ backdropFilter: "blur(4px)" }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 w-full sm:w-[420px] flex flex-col"
        style={{
          background: "var(--canvas-nocturne, #1e2416)",
          borderLeft: "1px solid rgba(154, 171, 126, 0.12)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          opacity: isOpen ? 1 : 0,
          transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
          boxShadow: isOpen ? "-8px 0 32px rgba(30, 36, 22, 0.5)" : "none",
        }}
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="AIRE AI Copilot"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(154, 171, 126, 0.12)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(154, 171, 126, 0.15)" }}>
              <Sparkles size={14} style={{ color: "#9aab7e" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e8e4d8", fontFamily: "var(--font-body, Space Grotesk, sans-serif)" }}>
                AIRE Copilot
              </p>
              <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(154, 171, 126, 0.6)" }}>
                {context.address.split(",")[0]}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "rgba(232, 228, 216, 0.4)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#e8e4d8")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(232, 228, 216, 0.4)")}
            aria-label="Close copilot"
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(154, 171, 126, 0.08)", border: "1px solid rgba(154, 171, 126, 0.12)" }}>
                <p className="text-sm leading-relaxed" style={{ color: "#e8e4d8", fontFamily: "var(--font-body)" }}>
                  I know this deal. Ask me anything — deadlines, drafts, Louisiana rules, or next steps.
                </p>
              </div>

              {/* Suggested prompts */}
              <div>
                <p className="text-[10px] uppercase tracking-[0.08em] mb-2.5" style={{ color: "rgba(107, 125, 82, 0.7)" }}>
                  Suggested
                </p>
                <div className="space-y-2">
                  {SUGGESTED_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-all"
                      style={{
                        color: "rgba(232, 228, 216, 0.7)",
                        background: "rgba(154, 171, 126, 0.05)",
                        border: "1px solid rgba(154, 171, 126, 0.10)",
                        fontFamily: "var(--font-body)",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(154, 171, 126, 0.10)"
                        e.currentTarget.style.color = "#e8e4d8"
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(154, 171, 126, 0.05)"
                        e.currentTarget.style.color = "rgba(232, 228, 216, 0.7)"
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-xl px-3.5 py-2.5"
                  style={
                    msg.role === "user"
                      ? {
                          background: "#6b7d52",
                          color: "#f5f2ea",
                        }
                      : {
                          background: "rgba(154, 171, 126, 0.08)",
                          border: "1px solid rgba(154, 171, 126, 0.12)",
                          color: "#e8e4d8",
                        }
                  }
                >
                  {msg.role === "assistant" && msg.content === "" ? (
                    <span className="inline-flex gap-1 items-center py-0.5">
                      {[0, 1, 2].map(j => (
                        <span
                          key={j}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: "#9aab7e",
                            animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </span>
                  ) : (
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {msg.content}
                      {msg.role === "assistant" && isStreaming && i === messages.length - 1 && (
                        <span
                          className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                          style={{
                            background: "#9aab7e",
                            animation: "pulse 0.8s ease-in-out infinite",
                          }}
                        />
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}

          {error && (
            <div className="rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "rgba(180, 80, 80, 0.10)", border: "1px solid rgba(180, 80, 80, 0.20)", color: "#d47070", fontFamily: "var(--font-body)" }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="shrink-0 px-4 py-4"
          style={{ borderTop: "1px solid rgba(154, 171, 126, 0.12)" }}
        >
          {messages.length > 0 && !isStreaming && (
            <div className="flex gap-2 mb-2.5 overflow-x-auto pb-1">
              {["What's next?", "Draft email", "Risks?"].map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-[11px] px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: "rgba(154, 171, 126, 0.08)",
                    border: "1px solid rgba(154, 171, 126, 0.15)",
                    color: "rgba(154, 171, 126, 0.8)",
                    fontFamily: "var(--font-body)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#9aab7e")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(154, 171, 126, 0.8)")}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this deal…"
              rows={1}
              className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
              style={{
                background: "rgba(154, 171, 126, 0.08)",
                border: "1px solid rgba(154, 171, 126, 0.18)",
                color: "#e8e4d8",
                fontFamily: "var(--font-body)",
                minHeight: "44px",
                maxHeight: "120px",
                boxShadow: "0 0 0 0 transparent",
                transition: "border-color 150ms ease, box-shadow 150ms ease",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "rgba(154, 171, 126, 0.45)"
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(154, 171, 126, 0.08)"
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "rgba(154, 171, 126, 0.18)"
                e.currentTarget.style.boxShadow = "0 0 0 0 transparent"
              }}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                style={{ background: "rgba(180, 80, 80, 0.15)", border: "1px solid rgba(180, 80, 80, 0.25)" }}
                aria-label="Stop generation"
              >
                <span className="w-3 h-3 rounded-sm" style={{ background: "#d47070" }} />
              </button>
            ) : (
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: input.trim() ? "#6b7d52" : "rgba(107, 125, 82, 0.15)",
                  border: "1px solid transparent",
                  opacity: input.trim() ? 1 : 0.5,
                }}
                onMouseEnter={e => { if (input.trim()) e.currentTarget.style.background = "#5a6c44" }}
                onMouseLeave={e => { if (input.trim()) e.currentTarget.style.background = "#6b7d52" }}
                aria-label="Send message"
              >
                <Send size={14} style={{ color: "#f5f2ea" }} />
              </button>
            )}
          </div>

          <p className="text-[10px] mt-2 text-center" style={{ color: "rgba(154, 171, 126, 0.35)", fontFamily: "var(--font-body)" }}>
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  )
}

/** Trigger button to open the copilot drawer */
export function CopilotTrigger({ onClick, hasActivity }: { onClick: () => void; hasActivity?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group"
      style={{
        background: "rgba(154, 171, 126, 0.06)",
        border: "1px solid rgba(154, 171, 126, 0.15)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(154, 171, 126, 0.12)"
        e.currentTarget.style.borderColor = "rgba(154, 171, 126, 0.30)"
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(154, 171, 126, 0.06)"
        e.currentTarget.style.borderColor = "rgba(154, 171, 126, 0.15)"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
        style={{ background: "rgba(154, 171, 126, 0.15)" }}
      >
        <Sparkles size={15} style={{ color: "#9aab7e" }} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-medium" style={{ color: "#1e2416", fontFamily: "var(--font-body)" }}>
          Ask AIRE Copilot
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "rgba(107, 125, 82, 0.6)", fontFamily: "var(--font-body)" }}>
          Drafts, risks, Louisiana rules
        </p>
      </div>
      {hasActivity && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#9aab7e" }} />
      )}
      <MessageSquare size={14} style={{ color: "rgba(107, 125, 82, 0.4)" }} />
    </button>
  )
}
