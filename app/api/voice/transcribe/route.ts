import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import OpenAI from "openai"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
      prompt: "Louisiana real estate transaction. Baton Rouge, Tchoupitoulas, Thibodaux, Natchitoches, Ascension Parish, East Baton Rouge, LREC, Act of Sale, purchase agreement, addendum, inspection, appraisal, Reve Realtors, GBRAR MLS.",
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    console.error("[Whisper] Transcription failed:", err)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
