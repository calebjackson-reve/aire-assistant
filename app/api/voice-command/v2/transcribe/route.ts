import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { transcribeAudio } from "@/lib/voice/whisper"

/**
 * Alias of /api/voice/transcribe — exposed under the v2 voice pipeline
 * namespace so callers can stay within the single /api/voice-command/v2/*
 * surface. Both routes share the same Whisper helper.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[Whisper v2] OPENAI_API_KEY not set — fallback to Web Speech")
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured", fallback: "web-speech" },
      { status: 503 }
    )
  }

  const start = Date.now()
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File | null
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const text = await transcribeAudio(audioFile)
    const ms = Date.now() - start
    console.log(`[Whisper v2] Transcribed ${audioFile.size}B in ${ms}ms`)
    return NextResponse.json({ text, ms })
  } catch (err) {
    console.error("[Whisper v2] Transcription failed:", err)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
