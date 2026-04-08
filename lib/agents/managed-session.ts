/**
 * AIRE Managed Agent Session Manager
 * Handles session persistence for agents that benefit from Anthropic's hosted runtime.
 *
 * Managed Agents: Morning Brief, Deal Rescue, Learning Cron, Lead Scoring
 * Serverless (unchanged): Voice, Content, Compliance, Email Scan, user-facing APIs
 */

import prisma from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic()

const SESSION_TTL_MS = 23 * 60 * 60 * 1000 // 23 hours (Anthropic sessions last 24h)

/**
 * Get an existing active session or create a new one.
 * Sessions are reused within their TTL to maintain persistent context.
 */
export async function getOrCreateSession(
  userId: string,
  agentName: string
): Promise<{ sessionId: string; isNew: boolean }> {
  // Check for existing active session
  const existing = await prisma.managedAgentSession.findFirst({
    where: {
      userId,
      agentName,
      status: "active",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (existing) {
    return { sessionId: existing.sessionId, isNew: false }
  }

  // Create new Anthropic managed agent session
  // Note: This uses the Anthropic agents API which is in public beta
  // Fallback to standard API calls if managed agents are not available
  try {
    const session = await (anthropic as unknown as {
      agents: {
        sessions: {
          create: (opts: { model: string }) => Promise<{ id: string }>
        }
      }
    }).agents.sessions.create({
      model: "claude-sonnet-4-20250514",
    })

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    await prisma.managedAgentSession.create({
      data: {
        userId,
        agentName,
        sessionId: session.id,
        status: "active",
        expiresAt,
      },
    })

    return { sessionId: session.id, isNew: true }
  } catch (error) {
    // Managed agents API not available — return a placeholder
    // Callers should fall back to standard API calls
    console.error(`[ManagedSession] Failed to create session for ${agentName}:`, error)
    throw new Error("Managed agent sessions not available — use standard API calls")
  }
}

/**
 * Send a message to a managed agent session.
 * Returns the agent's response text.
 */
export async function sendToAgent(
  sessionId: string,
  message: string
): Promise<string> {
  try {
    const response = await (anthropic as unknown as {
      agents: {
        messages: {
          create: (opts: { sessionId: string; messages: Array<{ role: string; content: string }> }) => Promise<{
            content: Array<{ type: string; text?: string }>
          }>
        }
      }
    }).agents.messages.create({
      sessionId,
      messages: [{ role: "user", content: message }],
    })

    return response.content[0].type === "text" ? (response.content[0].text || "") : ""
  } catch (error) {
    console.error("[ManagedSession] Failed to send message:", error)
    throw error
  }
}

/**
 * Clean up expired sessions. Run as part of a cron job.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.managedAgentSession.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  })

  return result.count
}

/**
 * Cancel a specific session (e.g., when user logs out).
 */
export async function cancelSession(sessionId: string): Promise<void> {
  try {
    await (anthropic as unknown as {
      agents: {
        sessions: {
          cancel: (sessionId: string) => Promise<void>
        }
      }
    }).agents.sessions.cancel(sessionId)
  } catch {
    // Session may already be expired on Anthropic's side
  }

  await prisma.managedAgentSession.updateMany({
    where: { sessionId },
    data: { status: "cancelled" },
  })
}

/**
 * Try to use a managed agent session, with automatic fallback to standard API.
 * This is the recommended pattern for migrating agents:
 *
 * const result = await withManagedAgent(userId, "morning_brief", async (send) => {
 *   return send("Generate the morning brief for today")
 * }, async () => {
 *   // Fallback: use standard anthropic.messages.create()
 *   return standardMorningBrief(userId)
 * })
 */
export async function withManagedAgent<T>(
  userId: string,
  agentName: string,
  managedFn: (send: (message: string) => Promise<string>) => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<{ result: T; source: "managed" | "fallback" }> {
  try {
    const { sessionId } = await getOrCreateSession(userId, agentName)
    const send = (message: string) => sendToAgent(sessionId, message)
    const result = await managedFn(send)
    return { result, source: "managed" }
  } catch {
    // Managed agents not available — use fallback
    const result = await fallbackFn()
    return { result, source: "fallback" }
  }
}
