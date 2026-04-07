/**
 * GET /api/voice-command/analytics?days=7
 *
 * Returns voice pipeline analytics: timing distributions, intent breakdown,
 * confidence stats, fast-path hit rate, and recent commands.
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import prisma from "@/lib/prisma"

interface TimingData {
  totalMs?: number
  classifyMs?: number
  normalizeMs?: number
  executeMs?: number
}

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get("days") || "7", 10), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const commands = await prisma.voiceCommand.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rawTranscript: true,
      parsedIntent: true,
      confidence: true,
      status: true,
      result: true,
      createdAt: true,
    },
  })

  // Extract timing from result JSON
  const timings: Array<TimingData & { intent: string; confidence: number; date: string }> = []
  for (const cmd of commands) {
    const r = cmd.result as Record<string, unknown> | null
    const timing = r?.timing as TimingData | undefined
    timings.push({
      totalMs: timing?.totalMs,
      classifyMs: timing?.classifyMs,
      normalizeMs: timing?.normalizeMs,
      executeMs: timing?.executeMs,
      intent: cmd.parsedIntent || "unknown",
      confidence: cmd.confidence || 0,
      date: cmd.createdAt.toISOString().slice(0, 10),
    })
  }

  // Aggregate stats
  const totalCommands = commands.length
  const completedTimings = timings.filter(t => t.totalMs != null)
  const avgTotalMs = completedTimings.length > 0
    ? Math.round(completedTimings.reduce((s, t) => s + (t.totalMs || 0), 0) / completedTimings.length)
    : 0
  const avgClassifyMs = completedTimings.length > 0
    ? Math.round(completedTimings.reduce((s, t) => s + (t.classifyMs || 0), 0) / completedTimings.length)
    : 0
  const p95TotalMs = completedTimings.length > 0
    ? completedTimings.map(t => t.totalMs || 0).sort((a, b) => a - b)[Math.floor(completedTimings.length * 0.95)] || 0
    : 0

  // Fast-path rate: classifyMs === 0 means regex matched
  const fastPathCount = completedTimings.filter(t => t.classifyMs === 0).length
  const fastPathRate = totalCommands > 0 ? fastPathCount / totalCommands : 0

  // Intent breakdown
  const intentCounts: Record<string, number> = {}
  for (const t of timings) {
    intentCounts[t.intent] = (intentCounts[t.intent] || 0) + 1
  }
  const intentBreakdown = Object.entries(intentCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([intent, count]) => ({ intent, count, pct: totalCommands > 0 ? count / totalCommands : 0 }))

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const cmd of commands) {
    statusCounts[cmd.status] = (statusCounts[cmd.status] || 0) + 1
  }

  // Confidence distribution
  const avgConfidence = timings.length > 0
    ? timings.reduce((s, t) => s + t.confidence, 0) / timings.length
    : 0
  const lowConfCount = timings.filter(t => t.confidence < 0.7).length

  // Daily volume (last N days)
  const dailyVolume: Record<string, number> = {}
  for (const t of timings) {
    dailyVolume[t.date] = (dailyVolume[t.date] || 0) + 1
  }

  // Recent commands (last 20)
  const recent = commands.slice(0, 20).map(cmd => {
    const r = cmd.result as Record<string, unknown> | null
    const timing = r?.timing as TimingData | undefined
    return {
      id: cmd.id,
      transcript: cmd.rawTranscript,
      intent: cmd.parsedIntent,
      confidence: cmd.confidence,
      status: cmd.status,
      totalMs: timing?.totalMs,
      classifyMs: timing?.classifyMs,
      createdAt: cmd.createdAt.toISOString(),
    }
  })

  return NextResponse.json({
    days,
    totalCommands,
    timing: { avgTotalMs, avgClassifyMs, p95TotalMs },
    fastPath: { count: fastPathCount, rate: fastPathRate },
    confidence: { avg: avgConfidence, lowConfCount },
    intentBreakdown,
    statusCounts,
    dailyVolume,
    recent,
  })
}
