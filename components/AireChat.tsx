"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function AireChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return

    const userMessage: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setStreaming(true)

    // Add empty assistant message for streaming
    setMessages([...newMessages, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) throw new Error("Chat failed")

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6)
              if (data === "[DONE]") break
              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  assistantContent += parsed.text
                  setMessages([...newMessages, { role: "assistant", content: assistantContent }])
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err)
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }])
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating chat button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-[#1e2416] text-[#f5f2ea] flex items-center justify-center shadow-[0_8px_32px_rgba(30,36,22,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
        style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        aria-label="Open AIRE chat"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[380px] h-[520px] rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: "rgba(245, 242, 234, 0.95)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 24px 80px rgba(30, 36, 22, 0.2), 0 8px 32px rgba(30, 36, 22, 0.1), inset 0 1px 0 rgba(255,255,255,0.5)",
            border: "1px solid rgba(107, 125, 82, 0.15)",
            animation: "chat-open 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#6b7d52]/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#6b7d52] flex items-center justify-center">
              <span className="text-[#f5f2ea] text-xs font-bold italic" style={{ fontFamily: "var(--font-cormorant)" }}>A</span>
            </div>
            <div>
              <p className="text-[#1e2416] text-sm font-medium">AIRE Intelligence</p>
              <p className="text-[#6b7d52] text-[10px] tracking-wider uppercase" style={{ fontFamily: "var(--font-ibm-mono)" }}>
                {streaming ? "Thinking..." : "Online"}
              </p>
            </div>
            <div className="ml-auto">
              <span className={`w-2 h-2 rounded-full inline-block ${streaming ? "bg-amber-400 animate-pulse" : "bg-[#6BBF59]"}`} />
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(154,171,126,0.3) transparent" }}>
            {messages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[#1e2416] text-lg italic mb-2" style={{ fontFamily: "var(--font-cormorant)" }}>
                  How can I help?
                </p>
                <p className="text-[#6b7d52]/60 text-xs">
                  Ask about your deals, deadlines, market data, or anything real estate.
                </p>
                <div className="mt-6 space-y-2">
                  {["What deadlines are coming up?", "Run a CMA on my listing", "Draft an inspection response"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus() }}
                      className="block w-full text-left px-4 py-2.5 rounded-xl text-xs text-[#3a4a28] bg-white/60 border border-[#6b7d52]/10 hover:bg-white hover:border-[#6b7d52]/20 transition-all duration-200"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1e2416] text-[#f5f2ea] rounded-br-md"
                      : "bg-white/80 text-[#1e2416] border border-[#6b7d52]/10 rounded-bl-md"
                  }`}
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]/40 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]/40 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6b7d52]/40 animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#6b7d52]/10 bg-white/40">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AIRE anything..."
                rows={1}
                className="flex-1 resize-none bg-white/70 border border-[#6b7d52]/15 rounded-xl px-4 py-2.5 text-[13px] text-[#1e2416] placeholder:text-[#6b7d52]/40 focus:outline-none focus:border-[#6b7d52]/30 focus:ring-1 focus:ring-[#9aab7e]/20 transition-all"
                style={{ fontFamily: "var(--font-space-grotesk)", maxHeight: "120px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className="w-9 h-9 rounded-xl bg-[#6b7d52] text-[#f5f2ea] flex items-center justify-center hover:bg-[#5a6c44] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes chat-open {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}
