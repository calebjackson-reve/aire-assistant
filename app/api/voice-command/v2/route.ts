/**
 * Voice Command API v2 — Single-pass classify pipeline
 * Replaces the two-step classify → execute flow with a single optimized call.
 * Target: < 8 seconds total response time.
 *
 * POST: Process voice transcript → classify → return result
 * The execute step is triggered separately via /api/voice-command/execute
 * (unchanged — the v2 pipeline just makes classification faster)
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"
import { runVoicePipeline } from "@/lib/voice-pipeline"

export async function POST(req: NextRequest) {
  const requestStart = Date.now()

  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const transcript = body.transcript as string

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return NextResponse.json({ error: "Transcript required" }, { status: 400 })
    }

    // Run optimized pipeline with 15s timeout
    const timeoutMs = 15000
    const result = await Promise.race([
      runVoicePipeline({ userId: user.id, transcript: transcript.trim() }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Pipeline timeout")), timeoutMs)
      ),
    ])

    const totalMs = Date.now() - requestStart

    return NextResponse.json({
      ...result,
      timing: { ...result.timing, totalMs, requestOverheadMs: totalMs - result.timing.totalMs },
    })
  } catch (error) {
    const totalMs = Date.now() - requestStart

    if (error instanceof Error && error.message === "Pipeline timeout") {
      console.error(`[Voice v2] Pipeline timeout after ${totalMs}ms`)
      return NextResponse.json({
        voiceCommandId: null,
        intent: "needs_clarification",
        entities: {},
        response: "That took too long. Could you try a simpler command?",
        action: null,
        confidence: 0,
        needsClarification: true,
        clarificationOptions: ["Try: 'Show my pipeline'", "Try: 'Check deadlines'"],
        timing: { totalMs, classifyMs: totalMs, normalizeMs: 0, executeMs: 0 },
      }, { status: 200 }) // 200 because we return a valid response
    }

    console.error("[Voice v2] Pipeline error:", error)
    return NextResponse.json({ error: "Voice command processing failed" }, { status: 500 })
  }
}
