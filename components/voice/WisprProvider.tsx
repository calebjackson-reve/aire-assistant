"use client"

// WisprProvider — holds recording state + toast queue for the Wispr voice
// experience. Wraps the entire authenticated app so the button and toast can
// render anywhere.
//
// Responsibilities:
//   1. Start / stop MediaRecorder when the user holds the side button
//   2. POST audio to /api/voice/wispr, receive { transcript, intent, result }
//   3. Push a WisprToast with the result (and an undoToken if reversible)
//   4. Manage a 10s undo window per action

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type WisprToastTone = "ok" | "warn" | "error" | "info"

export type WisprToast = {
  id: string
  tone: WisprToastTone
  title: string
  detail?: string
  undoToken?: string // if present, an Undo button is shown for 10s
  createdAt: number
}

type WisprState = {
  isRecording: boolean
  isProcessing: boolean
  elapsed: number // seconds while recording
  toasts: WisprToast[]
  startRecording: () => void
  stopRecording: () => Promise<void>
  cancelRecording: () => void
  dismissToast: (id: string) => void
  undoAction: (undoToken: string) => Promise<void>
}

const WisprContext = createContext<WisprState | null>(null)

export function useWispr(): WisprState {
  const ctx = useContext(WisprContext)
  if (!ctx) throw new Error("useWispr must be used within <WisprProvider>")
  return ctx
}

export function WisprProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [toasts, setToasts] = useState<WisprToast[]>([])

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTsRef = useRef<number>(0)
  const cancelledRef = useRef<boolean>(false)

  const pushToast = useCallback((toast: Omit<WisprToast, "id" | "createdAt">) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [
      ...prev,
      { ...toast, id, createdAt: Date.now() },
    ])
    // Auto-dismiss after 10s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 10_000)
  }, [])

  const stopMedia = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    recorderRef.current = null
  }, [])

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return
    cancelledRef.current = false
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream, { mimeType: pickMimeType() })
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.start(250)
      recorderRef.current = rec
      startTsRef.current = Date.now()
      setElapsed(0)
      setIsRecording(true)
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTsRef.current) / 1000))
      }, 100)
    } catch (err) {
      console.warn("[wispr] getUserMedia failed:", err)
      pushToast({
        tone: "error",
        title: "Microphone unavailable",
        detail: "Grant microphone permission in browser settings.",
      })
    }
  }, [isRecording, isProcessing, pushToast])

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true
    stopMedia()
    setIsRecording(false)
    setElapsed(0)
  }, [stopMedia])

  const stopRecording = useCallback(async () => {
    if (!isRecording || !recorderRef.current) return
    const rec = recorderRef.current
    const durationMs = Date.now() - startTsRef.current
    // Bail if held < 400ms — treat as an accidental tap
    if (durationMs < 400) {
      cancelRecording()
      pushToast({
        tone: "info",
        title: "Hold the button while speaking.",
      })
      return
    }
    // Wait for final ondataavailable to land
    const donePromise = new Promise<void>((resolve) => {
      rec.onstop = () => resolve()
    })
    rec.stop()
    await donePromise
    stopMedia()
    setIsRecording(false)
    setElapsed(0)

    if (cancelledRef.current || chunksRef.current.length === 0) return
    setIsProcessing(true)

    try {
      const mimeType = rec.mimeType || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const form = new FormData()
      form.append("audio", blob, `wispr-${Date.now()}.webm`)
      form.append("durationMs", String(durationMs))

      const res = await fetch("/api/voice/wispr", {
        method: "POST",
        body: form,
      })
      const data = (await res.json()) as WisprApiResponse

      if (!res.ok || !data.ok) {
        pushToast({
          tone: "error",
          title: data.error || "Something went wrong",
          detail: data.detail,
        })
        return
      }

      pushToast({
        tone: data.tone || "ok",
        title: data.title,
        detail: data.detail,
        undoToken: data.undoToken,
      })
    } catch (err) {
      console.warn("[wispr] api error:", err)
      pushToast({
        tone: "error",
        title: "Voice service unreachable",
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isRecording, stopMedia, cancelRecording, pushToast])

  const undoAction = useCallback(
    async (undoToken: string) => {
      try {
        const res = await fetch("/api/voice/wispr/undo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ undoToken }),
        })
        if (res.ok) {
          pushToast({ tone: "info", title: "Undone." })
          setToasts((prev) => prev.filter((t) => t.undoToken !== undoToken))
        } else {
          pushToast({ tone: "warn", title: "Could not undo (already committed)." })
        }
      } catch {
        pushToast({ tone: "error", title: "Undo failed — network error." })
      }
    },
    [pushToast],
  )

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    return () => {
      stopMedia()
    }
  }, [stopMedia])

  const value = useMemo<WisprState>(
    () => ({
      isRecording,
      isProcessing,
      elapsed,
      toasts,
      startRecording,
      stopRecording,
      cancelRecording,
      dismissToast,
      undoAction,
    }),
    [isRecording, isProcessing, elapsed, toasts, startRecording, stopRecording, cancelRecording, dismissToast, undoAction],
  )

  return <WisprContext.Provider value={value}>{children}</WisprContext.Provider>
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ]
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m
  }
  return "audio/webm"
}

type WisprApiResponse =
  | {
      ok: true
      title: string
      detail?: string
      tone?: WisprToastTone
      transcript?: string
      undoToken?: string
    }
  | {
      ok: false
      error: string
      detail?: string
    }
