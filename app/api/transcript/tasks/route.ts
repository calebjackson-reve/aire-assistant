import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { parseTranscript, toClickUpTasks } from "@/lib/transcript-to-tasks"
import { createTasks } from "@/lib/clickup"

/**
 * POST /api/transcript/tasks
 *
 * Accepts a transcript, extracts tasks via Claude, and creates them in ClickUp.
 *
 * Body: { transcript: string, listId?: string }
 * - transcript: The raw transcript text
 * - listId: ClickUp list ID (falls back to CLICKUP_LIST_ID env var)
 *
 * Response: { summary, tasks, clickup: { created, errors } }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { transcript, listId } = await req.json()

    if (!transcript || typeof transcript !== "string" || transcript.trim().length === 0) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 })
    }

    // Step 1: Parse transcript into structured tasks
    const parsed = await parseTranscript(transcript)

    if (parsed.tasks.length === 0) {
      return NextResponse.json({
        summary: parsed.summary,
        tasks: [],
        clickup: { created: [], errors: [] },
        message: "No actionable tasks found in transcript.",
      })
    }

    // Step 2: Convert to ClickUp format and create tasks
    const targetListId = listId || process.env.CLICKUP_LIST_ID
    if (!targetListId) {
      // Return parsed tasks without pushing to ClickUp (no list configured)
      return NextResponse.json({
        summary: parsed.summary,
        tasks: parsed.tasks,
        clickup: null,
        message: "Tasks extracted but CLICKUP_LIST_ID is not configured. Set it in env vars or pass listId in the request.",
      })
    }

    const clickUpTasks = toClickUpTasks(parsed.tasks)
    const clickup = await createTasks(targetListId, clickUpTasks)

    return NextResponse.json({
      summary: parsed.summary,
      tasks: parsed.tasks,
      clickup,
      message: `Created ${clickup.created.length} task(s) in ClickUp.`,
    })
  } catch (err) {
    console.error("[transcript/tasks] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
