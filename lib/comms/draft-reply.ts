import Anthropic from "@anthropic-ai/sdk"
import { type UnansweredMessage } from "./types"

const anthropic = new Anthropic()

/**
 * Generate a draft reply for an unanswered message using Claude.
 */
export async function generateDraftReply(msg: UnansweredMessage, agentName: string): Promise<string> {
  const channelContext = msg.channel === "sms" ? "Keep it under 160 characters. Casual but professional." : "Professional email tone. Brief — 2-3 sentences max."

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are ${agentName}, a Louisiana REALTOR at Reve Realtors in Baton Rouge.

Draft a reply to this ${msg.channel} message:
From: ${msg.contactName ?? msg.from}
Subject: ${msg.subject ?? "(none)"}
Preview: ${msg.bodyPreview}

Rules:
- ${channelContext}
- Acknowledge their message specifically
- Be warm, professional, Ninja Selling tone
- Never discuss commission rates or discriminatory topics (Fair Housing)
- If unclear what they need, ask one clarifying question
- Sign off with just your first name

Reply only with the draft text, nothing else.`,
      },
    ],
  })

  const block = response.content[0]
  return block.type === "text" ? block.text : ""
}

/**
 * Generate draft replies for all unanswered messages and store them.
 */
export async function generateDraftReplies(
  messages: UnansweredMessage[],
  agentName: string
): Promise<Map<string, string>> {
  const drafts = new Map<string, string>()

  // Only draft for high/critical urgency to save API calls
  const urgent = messages.filter((m) => m.urgency === "high" || m.urgency === "critical")

  for (const msg of urgent.slice(0, 5)) {
    try {
      const draft = await generateDraftReply(msg, agentName)
      drafts.set(msg.id, draft)
    } catch (err) {
      console.error(`[CommsMonitor] Draft failed for ${msg.id}:`, err)
    }
  }

  return drafts
}
