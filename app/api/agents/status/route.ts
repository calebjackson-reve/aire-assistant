/**
 * GET /api/agents/status — Agent registry dashboard
 * Returns status of all agents: last run, success rate, timing.
 */

import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getAgentRegistry } from "@/lib/agents/agent-infrastructure"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const registry = await getAgentRegistry()
    return NextResponse.json({ agents: registry })
  } catch (error) {
    console.error("[AgentRegistry] Error:", error)
    return NextResponse.json({ error: "Failed to fetch agent status" }, { status: 500 })
  }
}
