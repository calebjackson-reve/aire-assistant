"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ─── Types mirroring the API payloads ────────────────────────────────────────

interface RailItem {
  key: string
  label: string
  shortLabel: string
  description: string
  rail: number
  isCurrent: boolean
  isComplete: boolean
  isFuture: boolean
}

interface QuestionShape {
  key: string
  prompt: string
  helperHint?: string
  quickReplies?: { label: string; value: string }[] | null
}

interface SilentAction {
  at: string
  kind:
    | "data_pull"
    | "doc_drafted"
    | "deadline_created"
    | "message_drafted"
    | "transaction_created"
    | "stage_entered"
    | "note"
  summary: string
  payload?: Record<string, unknown>
}

interface ChatTurn {
  role: "aire" | "user"
  content: string
  at: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TCSWalkthrough() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rail, setRail] = useState<RailItem[]>([])
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [actions, setActions] = useState<SilentAction[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<QuestionShape | null>(null)
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  // Kick off a session on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/tcs/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
        if (!res.ok) throw new Error(`Failed to start (${res.status})`)
        const data = await res.json()
        if (cancelled) return
        setSessionId(data.sessionId)
        setRail(data.rail ?? [])
        setTurns([
          {
            role: "aire",
            at: new Date().toISOString(),
            content:
              "Let's walk through this deal together. I'll ask a few questions — everything else I'll handle in the background.",
          },
          ...(data.firstQuestion
            ? [
                {
                  role: "aire" as const,
                  at: new Date().toISOString(),
                  content: data.firstQuestion.prompt,
                },
              ]
            : []),
        ])
        setCurrentQuestion(data.firstQuestion ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to start")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Autoscroll feed on new turn / action
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [turns, actions])

  const submit = useCallback(
    async (value: string) => {
      if (!sessionId || !currentQuestion || submitting) return
      const trimmed = value.trim()
      if (!trimmed) return
      setSubmitting(true)
      setError(null)

      // Optimistic: show user turn
      setTurns((t) => [
        ...t,
        { role: "user", content: trimmed, at: new Date().toISOString() },
      ])
      setInput("")

      try {
        const res = await fetch("/api/tcs/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            questionKey: currentQuestion.key,
            answer: trimmed,
          }),
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(`Submit failed: ${txt || res.status}`)
        }
        const turn: {
          session: { id: string; transactionId: string | null; currentStage: string }
          actions: SilentAction[]
          stageAdvanced: boolean
          nextQuestion: QuestionShape | null
          complete: boolean
          rail: RailItem[]
        } = await res.json()

        setRail(turn.rail)
        setActions((a) => [...a, ...turn.actions])
        setTransactionId(turn.session.transactionId)

        if (turn.nextQuestion) {
          setTurns((t) => [
            ...t,
            {
              role: "aire",
              content: turn.nextQuestion!.prompt,
              at: new Date().toISOString(),
            },
          ])
          setCurrentQuestion(turn.nextQuestion)
        } else {
          setCurrentQuestion(null)
          if (turn.complete) setComplete(true)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed")
      } finally {
        setSubmitting(false)
      }
    },
    [sessionId, currentQuestion, submitting],
  )

  const onEnter = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        submit(input)
      }
    },
    [input, submit],
  )

  // Silent actions are deduped by (at + summary) for safety against re-renders
  const dedupedActions = useMemo(() => {
    const seen = new Set<string>()
    const out: SilentAction[] = []
    for (const a of actions) {
      const k = `${a.at}::${a.summary}`
      if (!seen.has(k)) {
        seen.add(k)
        out.push(a)
      }
    }
    return out
  }, [actions])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f2ea", // Cream
        color: "#2c3520", // Forest text
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      {/* ─── Sticky stage rail ─────────────────────────────────────────── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#f0ece2", // Warm white
          borderBottom: "1px solid #c5c9b8",
          boxShadow: "0 1px 3px rgba(30,36,22,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "18px 32px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: "-0.01em",
                color: "#1e2416",
              }}
            >
              New walkthrough
            </div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#8a9070",
                marginTop: 4,
              }}
            >
              Transaction Coordination System
            </div>
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 360,
              display: "flex",
              gap: 8,
              overflowX: "auto",
              alignItems: "center",
            }}
          >
            {rail.map((item, idx) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: item.isCurrent
                      ? "#6b7d52"
                      : item.isComplete
                        ? "rgba(154,171,126,0.25)"
                        : "transparent",
                    border: item.isCurrent
                      ? "1.5px solid #6b7d52"
                      : "1px solid #c5c9b8",
                    color: item.isCurrent
                      ? "#f5f2ea"
                      : item.isComplete
                        ? "#4a5638"
                        : "#8a9070",
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      opacity: 0.7,
                    }}
                  >
                    {String(item.rail).padStart(2, "0")}
                  </span>
                  {item.shortLabel}
                </div>
                {idx < rail.length - 1 && (
                  <span
                    style={{
                      color: "#c5c9b8",
                      fontSize: 12,
                    }}
                  >
                    ·
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Main two-column area ──────────────────────────────────────── */}
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "32px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 340px",
          gap: 32,
          alignItems: "start",
        }}
      >
        {/* ── Conversation column ─────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "calc(100vh - 200px)",
          }}
        >
          <div
            ref={feedRef}
            style={{
              flex: 1,
              overflowY: "auto",
              background: "#f0ece2",
              border: "1px solid #c5c9b8",
              borderRadius: 12,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 1px 3px rgba(30,36,22,0.06), 0 4px 12px rgba(30,36,22,0.04)",
              minHeight: 420,
            }}
          >
            {turns.map((t, i) => (
              <TurnBubble key={i} turn={t} />
            ))}

            {currentQuestion?.quickReplies && currentQuestion.quickReplies.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {currentQuestion.quickReplies.map((qr) => (
                  <button
                    key={qr.value}
                    onClick={() => submit(qr.value)}
                    disabled={submitting}
                    style={{
                      padding: "9px 18px",
                      border: "1.5px solid #6b7d52",
                      background: "transparent",
                      color: "#6b7d52",
                      borderRadius: 6,
                      fontFamily: "'Space Grotesk', system-ui, sans-serif",
                      fontWeight: 500,
                      fontSize: 14,
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.6 : 1,
                      transition: "transform 140ms ease, background-color 140ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(106,125,82,0.08)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

            {complete && (
              <div
                style={{
                  marginTop: 8,
                  padding: 16,
                  background: "#eaf2e4",
                  borderLeft: "3px solid #6b7d52",
                  borderRadius: 6,
                  color: "#4a5638",
                  fontSize: 14,
                }}
              >
                Walkthrough complete. {transactionId ? "This deal is now fully tracked in your pipeline." : ""}
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onEnter}
              placeholder={
                currentQuestion?.helperHint ??
                (currentQuestion ? "Type your answer…" : "Walkthrough complete")
              }
              disabled={!currentQuestion || submitting}
              style={{
                flex: 1,
                padding: "12px 16px",
                minHeight: 46,
                border: "1.5px solid #c5c9b8",
                borderRadius: 6,
                background: "#f5f2ea",
                color: "#2c3520",
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: 15,
                outline: "none",
                transition: "border-color 140ms ease, box-shadow 140ms ease",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#6b7d52"
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(154,171,126,0.2)"
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#c5c9b8"
                e.currentTarget.style.boxShadow = "none"
              }}
            />
            <button
              onClick={() => submit(input)}
              disabled={!currentQuestion || !input.trim() || submitting}
              style={{
                padding: "12px 24px",
                background: "#6b7d52",
                color: "#f5f2ea",
                border: "none",
                borderRadius: 6,
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontWeight: 500,
                fontSize: 15,
                cursor:
                  !currentQuestion || !input.trim() || submitting
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  !currentQuestion || !input.trim() || submitting ? 0.5 : 1,
                transition: "transform 140ms ease, background-color 140ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#5a6b43"
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#6b7d52"
                e.currentTarget.style.transform = "translateY(0)"
              }}
            >
              {submitting ? "…" : "Send"}
            </button>
          </div>

          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "#f5e8e8",
                borderLeft: "3px solid #8b4a4a",
                borderRadius: 6,
                color: "#5a2a2a",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── Silent actions column ──────────────────────────────────── */}
        <div
          style={{
            position: "sticky",
            top: 96,
            background: "#f0ece2",
            borderLeft: "3px solid #6b7d52",
            borderRadius: 10,
            padding: 20,
            boxShadow: "0 1px 3px rgba(30,36,22,0.06)",
            maxHeight: "calc(100vh - 140px)",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8a9070",
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            Silent actions
          </div>
          {dedupedActions.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "#8a9070",
                fontStyle: "italic",
                lineHeight: 1.6,
              }}
            >
              Nothing yet. As you answer, I'll pull MLS records, run a CMA,
              draft docs, and schedule messages here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dedupedActions.slice().reverse().map((a, i) => (
                <ActionRow key={`${a.at}-${i}`} action={a} />
              ))}
            </div>
          )}
          {transactionId && (
            <a
              href={`/aire/transactions/${transactionId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                marginTop: 18,
                padding: "10px 14px",
                background: "#6b7d52",
                color: "#f5f2ea",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Open the deal →
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes tcsFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TurnBubble({ turn }: { turn: ChatTurn }) {
  const isAire = turn.role === "aire"
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isAire ? "flex-start" : "flex-end",
        animation: "tcsFadeIn 260ms ease both",
      }}
    >
      <div
        style={{
          maxWidth: "78%",
          padding: "12px 18px",
          borderRadius: 14,
          background: isAire ? "rgba(154,171,126,0.18)" : "#6b7d52",
          color: isAire ? "#1e2416" : "#f5f2ea",
          fontFamily: isAire
            ? "'Space Grotesk', system-ui, sans-serif"
            : "'Space Grotesk', system-ui, sans-serif",
          fontSize: 15,
          lineHeight: 1.55,
          border: isAire ? "1px solid rgba(106,125,82,0.25)" : "none",
        }}
      >
        {isAire ? (
          <>
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 13,
                color: "#6b7d52",
                letterSpacing: "0.02em",
                display: "block",
                marginBottom: 4,
              }}
            >
              AIRE
            </span>
            {turn.content}
          </>
        ) : (
          turn.content
        )}
      </div>
    </div>
  )
}

function ActionRow({ action }: { action: SilentAction }) {
  const color =
    action.kind === "transaction_created" || action.kind === "stage_entered"
      ? "#6b7d52"
      : action.kind === "note"
        ? "#b5956a"
        : "#4a5638"

  const glyph =
    action.kind === "transaction_created"
      ? "◆"
      : action.kind === "stage_entered"
        ? "▸"
        : action.kind === "note"
          ? "!"
          : "✓"

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        fontSize: 13,
        lineHeight: 1.4,
        animation: "tcsFadeIn 260ms ease both",
      }}
    >
      <span
        style={{
          color,
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 600,
          fontSize: 14,
          flexShrink: 0,
          width: 14,
          textAlign: "center",
        }}
      >
        {glyph}
      </span>
      <span style={{ color: "#2c3520", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.5 }}>
        {action.summary}
      </span>
    </div>
  )
}
