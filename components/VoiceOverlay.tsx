"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { FeedbackButtons } from "@/components/FeedbackButtons"

// Navigation map — voice can navigate the app
const NAV_MAP: Record<string, string> = {
  brief: "/aire",
  "morning brief": "/aire/morning-brief",
  inbox: "/aire/email",
  email: "/aire/email",
  deals: "/aire/transactions",
  transactions: "/aire/transactions",
  contacts: "/aire/relationships",
  people: "/aire/relationships",
  market: "/aire/intelligence",
  intelligence: "/aire/intelligence",
  airsign: "/airsign",
  "sign documents": "/airsign",
  settings: "/aire/settings",
  billing: "/billing",
  compliance: "/aire/compliance",
  contracts: "/aire/contracts",
  "new deal": "/aire/transactions/new",
  "new transaction": "/aire/transactions/new",
  "new envelope": "/airsign/new",
  monitoring: "/aire/monitoring",
}

interface VoiceOverlayProps {
  open: boolean
  onClose: () => void
}

interface Message {
  role: "user" | "assistant"
  text: string
  action?: { label: string; href: string }
}

// Browser TTS — AIRE speaks back
function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  // Cancel any ongoing speech
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  utterance.pitch = 1.0

  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v =>
    v.name.includes("Samantha") || v.name.includes("Google US English") ||
    v.name.includes("Microsoft Zira") || v.name.includes("Aria") ||
    (v.lang === "en-US" && v.localService)
  )
  if (preferred) utterance.voice = preferred

  window.speechSynthesis.speak(utterance)
}

export function VoiceOverlay({ open, onClose }: VoiceOverlayProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [interimText, setInterimText] = useState("") // Real-time words as you speak
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const lastCommandRef = useRef<{ text: string; time: number } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecogRef = useRef<any>(null)

  // Auto-focus input when overlay opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setMessages([])
      setInput("")
      stopRecording()
      window.speechSynthesis?.cancel()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) {
      window.addEventListener("keydown", handleKey)
      return () => window.removeEventListener("keydown", handleKey)
    }
  }, [open, onClose])

  // Try local navigation first before hitting the API
  function tryNavigate(text: string): boolean {
    const lower = text.toLowerCase().trim()

    const navPatterns = [
      /^(?:go to|open|show|navigate to|take me to)\s+(?:my\s+)?(.+)$/i,
      /^(.+)\s+page$/i,
    ]

    for (const pattern of navPatterns) {
      const match = lower.match(pattern)
      if (match) {
        const target = match[1].trim()
        for (const [key, path] of Object.entries(NAV_MAP)) {
          if (target.includes(key)) {
            const msg = `Opening ${key}...`
            setMessages(prev => [
              ...prev,
              { role: "user", text },
              { role: "assistant", text: msg, action: { label: `Go to ${key}`, href: path } },
            ])
            speak(msg)
            setTimeout(() => { router.push(path); onClose() }, 800)
            return true
          }
        }
      }
    }

    // Direct keyword match
    for (const [key, path] of Object.entries(NAV_MAP)) {
      if (lower === key) {
        const msg = `Opening ${key}...`
        setMessages(prev => [
          ...prev,
          { role: "user", text },
          { role: "assistant", text: msg, action: { label: `Go to ${key}`, href: path } },
        ])
        speak(msg)
        setTimeout(() => { router.push(path); onClose() }, 800)
        return true
      }
    }

    return false
  }

  // Send command to the voice pipeline API
  async function sendCommand(text: string) {
    if (!text.trim()) return

    // Track voice re-issues as implicit negative feedback
    if (lastCommandRef.current) {
      const timeDiff = Date.now() - lastCommandRef.current.time
      const firstWord = lastCommandRef.current.text.toLowerCase().split(" ")[0]
      if (timeDiff < 30000 && text.toLowerCase().includes(firstWord)) {
        fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feature: "voice",
            rating: 1,
            metadata: JSON.parse(JSON.stringify({ reissue: true, original: lastCommandRef.current.text, retry: text })),
          }),
        }).catch(() => {})
      }
    }
    lastCommandRef.current = { text, time: Date.now() }

    if (tryNavigate(text)) return

    setMessages(prev => [...prev, { role: "user", text }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/voice-command/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          context: { currentPage: pathname },
        }),
      })

      if (res.status === 403) {
        const msg = "Voice commands are a Pro feature. Upgrade to unlock AI-powered voice control, morning briefs, and more."
        setMessages(prev => [...prev, {
          role: "assistant",
          text: msg,
          action: { label: "Upgrade to Pro", href: "/billing" },
        }])
        speak("Voice commands are available on the Pro plan.")
      } else if (res.ok) {
        const data = await res.json()
        const intent = data.classification?.intent || "unknown"
        const response = data.response || data.classification?.response || "Command processed."

        let action: { label: string; href: string } | undefined
        if (intent === "create_transaction" && data.execution?.transactionId) {
          action = { label: "View transaction", href: `/aire/transactions/${data.execution.transactionId}` }
        } else if (intent === "check_pipeline") {
          action = { label: "View deals", href: "/aire/transactions" }
        } else if (intent === "write_contract") {
          action = { label: "View contracts", href: "/aire/contracts" }
        } else if (intent === "compliance_scan") {
          action = { label: "View compliance", href: "/aire/compliance" }
        }

        setMessages(prev => [...prev, { role: "assistant", text: response, action }])

        // AIRE speaks the response
        speak(response)
      } else {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        const errMsg = err.error || "Something went wrong. Try again."
        setMessages(prev => [...prev, { role: "assistant", text: errMsg }])
        speak(errMsg)
      }
    } catch {
      const errMsg = "Network error. Check your connection."
      setMessages(prev => [...prev, { role: "assistant", text: errMsg }])
      speak(errMsg)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendCommand(input)
  }

  // ── Whisper-powered recording ──
  // Records audio via MediaRecorder → sends to /api/voice/transcribe (Whisper)
  // Falls back to Web Speech API if Whisper endpoint returns 503 (no OpenAI key)

  // Start real-time speech preview (Web Speech API for interim text display)
  function startInterimSpeech() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return // No browser support, skip interim text

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true // Key: show words as they're spoken
    recognition.lang = "en-US"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = ""
      let final = ""
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + " "
        } else {
          interim += result[0].transcript
        }
      }
      setInterimText((final + interim).trim())
    }

    recognition.onerror = () => {
      // Silently fail — Whisper is the real transcriber
    }

    try {
      recognition.start()
      speechRecogRef.current = recognition
    } catch {
      // Already running or not supported
    }
  }

  function stopInterimSpeech() {
    if (speechRecogRef.current) {
      try { speechRecogRef.current.stop() } catch { /* ignore */ }
      speechRecogRef.current = null
    }
  }

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      audioChunksRef.current = []
      setInterimText("")

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        // Stop mic stream + interim speech
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        stopInterimSpeech()

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        if (audioBlob.size < 1000) {
          setRecording(false)
          setInterimText("")
          return // Too short, ignore
        }

        setTranscribing(true)
        setRecording(false)

        try {
          // Try Whisper first — best accuracy
          const formData = new FormData()
          formData.append("audio", audioBlob, "recording.webm")

          const res = await fetch("/api/voice/transcribe", { method: "POST", body: formData })

          if (res.ok) {
            const { text } = await res.json()
            if (text?.trim()) {
              setInterimText("")
              setInput(text)
              setTranscribing(false)
              sendCommand(text)
              return
            }
          }

          // Fallback: use the interim text from Web Speech API if Whisper unavailable
          if (res.status === 503 && interimText.trim()) {
            setTranscribing(false)
            const fallbackText = interimText.trim()
            setInterimText("")
            sendCommand(fallbackText)
            return
          }

          if (res.status === 503) {
            setTranscribing(false)
            setInterimText("")
            fallbackWebSpeech()
            return
          }

          setTranscribing(false)
          setInterimText("")
          setMessages(prev => [...prev, { role: "assistant", text: "Couldn't transcribe audio. Try typing instead." }])
        } catch {
          setTranscribing(false)
          setInterimText("")
          setMessages(prev => [...prev, { role: "assistant", text: "Transcription failed. Try typing instead." }])
        }
      }

      mediaRecorder.start()
      setRecording(true)

      // Start real-time word display in parallel
      startInterimSpeech()
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Microphone access denied. Please allow microphone access and try again." }])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, interimText])

  function stopRecording() {
    stopInterimSpeech()
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop()
    } else {
      setRecording(false)
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  // Fallback: browser Web Speech API (Chrome only)
  function fallbackWebSpeech() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: "assistant", text: "Add OPENAI_API_KEY to .env.local for voice, or use Chrome for browser speech recognition." }])
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript as string | undefined
      if (transcript) sendCommand(transcript)
    }
    recognition.onerror = () => {
      setMessages(prev => [...prev, { role: "assistant", text: "Speech recognition failed. Try typing." }])
    }
    recognition.start()
  }

  function toggleRecording() {
    if (recording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-forest-deep/95 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-sage" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <span className="text-cream font-display italic text-lg">AIRE</span>
        </div>
        <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <button
              onClick={toggleRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all cursor-pointer ${
                recording
                  ? "bg-[#c45c5c] ring-8 ring-[#c45c5c]/20 animate-pulse"
                  : transcribing
                    ? "bg-sage/30 animate-pulse"
                    : "bg-sage/20 hover:bg-sage/30 hover:scale-105 active:scale-95"
              }`}
            >
              {transcribing ? (
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-cream animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-cream animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-cream animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <svg className={`w-10 h-10 ${recording ? "text-cream" : "text-sage"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
            <p className="text-cream text-lg font-display italic mb-1">
              {recording ? "Listening..." : transcribing ? "Processing with Whisper..." : "Ask AIRE anything"}
            </p>

            {/* Real-time interim text — words appear as you speak */}
            {(recording || transcribing) && interimText ? (
              <div className="max-w-md mx-auto mb-4 px-4">
                <p className="text-cream/80 text-sm text-center leading-relaxed font-[family-name:var(--font-body)]">
                  {interimText}
                  {recording && <span className="inline-block w-0.5 h-4 bg-sage ml-0.5 animate-pulse align-middle" />}
                </p>
              </div>
            ) : (
              <p className="text-cream/40 text-sm max-w-md text-center mb-6">
                {recording
                  ? "Speak naturally — words will appear as you talk"
                  : "Tap the mic to speak, or type below. AIRE will respond by voice."
                }
              </p>
            )}
            {!recording && !transcribing && (
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {[
                  "What's my pipeline value?",
                  "Go to my deals",
                  "Create a transaction at 554 Ave F",
                  "Run compliance scan",
                  "Open AirSign",
                ].map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => sendCommand(cmd)}
                    className="text-xs px-3 py-1.5 rounded-full border border-cream/10 text-cream/50 hover:text-cream hover:border-cream/30 transition"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-sage/20 text-cream"
                    : "bg-cream/5 text-cream/90"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  {msg.action && (
                    <button
                      onClick={() => { router.push(msg.action!.href); onClose() }}
                      className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-sage/20 text-sage hover:bg-sage/30 transition inline-flex items-center gap-1.5"
                    >
                      {msg.action.label}
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  )}
                  {msg.role === "assistant" && (
                    <div className="mt-2 pt-1 border-t border-cream/5">
                      <FeedbackButtons
                        feature="voice"
                        metadata={{ response: msg.text }}
                        className="[&_span]:text-cream/20 [&_button]:text-cream/20 [&_button:hover]:text-green-400 [&_button:last-child:hover]:text-red-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(loading || transcribing) && (
              <div className="flex justify-start">
                <div className="bg-cream/5 rounded-2xl px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-sage/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-sage/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-sage/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-6 pb-6 pt-2">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all ${
              recording
                ? "bg-[#c45c5c] text-cream animate-pulse ring-4 ring-[#c45c5c]/30"
                : transcribing
                  ? "bg-sage/30 text-cream animate-pulse"
                  : "bg-sage/20 text-sage hover:bg-sage/30"
            }`}
          >
            {recording ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            )}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={recording ? (interimText || "Listening...") : transcribing ? "Whisper processing..." : "Type a command or tap the mic..."}
            className="flex-1 bg-cream/5 border border-cream/10 rounded-xl px-5 py-3 text-cream text-sm focus:outline-none focus:border-sage/40 placeholder:text-cream/20"
            disabled={loading || recording || transcribing}
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || recording || transcribing}
            className="w-12 h-12 rounded-full bg-sage/20 text-sage flex items-center justify-center shrink-0 hover:bg-sage/30 disabled:opacity-30 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
