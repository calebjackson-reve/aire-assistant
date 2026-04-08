// app/api/learning/errors/route.ts
// GET: Get error patterns for an agent (shows recurring errors)
// POST: Mark an error as resolved with { errorId, resolution }

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getErrorPatterns, resolveError } from "@/lib/learning/error-memory"

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const agentName = req.nextUrl.searchParams.get("agent")
    const minOccurrences = parseInt(req.nextUrl.searchParams.get("min") || "3", 10)

    if (!agentName) {
      return NextResponse.json({ error: "agent query param is required" }, { status: 400 })
    }

    const patterns = await getErrorPatterns(agentName, minOccurrences)
    return NextResponse.json({
      agent: agentName,
      minOccurrences,
      patterns: patterns.map(p => ({
        id: p.id,
        errorType: p.errorType,
        errorMessage: p.errorMessage,
        occurrences: p.occurrences,
        lastSeenAt: p.lastSeenAt,
        createdAt: p.createdAt,
      })),
    })
  } catch (error) {
    console.error("Error patterns error:", error)
    return NextResponse.json({ error: "Failed to get error patterns" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { errorId, resolution } = body

    if (!errorId || !resolution) {
      return NextResponse.json({ error: "errorId and resolution are required" }, { status: 400 })
    }

    const resolved = await resolveError(errorId, resolution)
    return NextResponse.json({
      id: resolved.id,
      resolved: true,
      resolvedAt: resolved.resolvedAt,
    })
  } catch (error) {
    console.error("Resolve error error:", error)
    return NextResponse.json({ error: "Failed to resolve error" }, { status: 500 })
  }
}
