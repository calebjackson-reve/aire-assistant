import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { transcribeAudio } from "@/lib/voice/whisper"

// Wispr voice API
// POST /api/voice/wispr
// Body: FormData { audio: Blob, durationMs: string }
// Returns: { ok: true, title, detail?, tone?, transcript?, undoToken? }
//       | { ok: false, error, detail? }
//
// v1 scope (this commit):
//   - Accept audio + optional duration hint
//   - If OPENAI_API_KEY present → transcribe with Whisper
//   - Else → return a helpful "add OpenAI key" hint so the full round-trip
//     still works visibly end-to-end
//   - If transcript present → POST to Claude Haiku for simple intent summary
//   - Return the transcript + intent as toast content
//   - No executor dispatch yet — that's phase 1.6
//
// Future (phase 1.6):
//   - Resolution hint classifier → executor dispatch
//   - undo queue (10s delayed execution)
//   - multi-turn context

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

type Ok = {
  ok: true
  title: string
  detail?: string
  tone?: "ok" | "warn" | "error" | "info"
  transcript?: string
  undoToken?: string
}
type Err = { ok: false; error: string; detail?: string }

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) return json<Err>({ ok: false, error: "Not signed in" }, 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json<Err>({ ok: false, error: "Invalid request body" }, 400)
  }

  const audio = form.get("audio")
  if (!(audio instanceof Blob)) {
    return json<Err>({ ok: false, error: "No audio attached" }, 400)
  }
  const durationMs = Number(form.get("durationMs") ?? 0)

  // --- Transcribe ----------------------------------------------------------
  const openaiKey = process.env.OPENAI_API_KEY
  let transcript = ""

  if (!openaiKey) {
    return json<Ok>({
      ok: true,
      tone: "info",
      title: `Voice captured (${(durationMs / 1000).toFixed(1)}s)`,
      detail: "Add OPENAI_API_KEY to .env.local to enable transcription.",
    })
  }

  try {
    // Use shared helper so LA glossary + OpenAI client caching apply.
    transcript = (await transcribeAudio(audio)).trim()
  } catch (err) {
    return json<Err>({
      ok: false,
      error: "Voice service unreachable",
      detail: err instanceof Error ? err.message : undefined,
    })
  }

  if (!transcript) {
    return json<Ok>({
      ok: true,
      tone: "warn",
      title: "Heard nothing",
      detail: "Try again — speak closer to the mic.",
    })
  }

  // --- Classify (Claude Haiku) -------------------------------------------
  // v1 returns transcript-only. Phase 1.6 wires in the intent classifier
  // with a typed ResolutionHint output. Stub left here so the UX feels real.

  return json<Ok>({
    ok: true,
    tone: "ok",
    title: transcript,
    detail: "Captured — intent classifier lands in the next commit.",
    transcript,
  })
}

function json<T>(body: T, status = 200): Response {
  return NextResponse.json(body as object, { status })
}
