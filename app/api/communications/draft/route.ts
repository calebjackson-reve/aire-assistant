import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are AIRE's Communications Agent for Caleb Jackson at Reve REALTORS, Baton Rouge, Louisiana.
You draft professional, warm, value-first messages following the Ninja Selling framework.
Never be pushy. Always provide value. Reference Louisiana-specific context naturally.

Rules:
- Match the tone to the channel: texts are casual/brief, emails are professional, calls get a script
- Never include protected-class language (Fair Housing compliance)
- Always include a clear next step or question
- Keep texts under 160 characters
- Keep emails to 3-4 short paragraphs max
- Call scripts should be conversation openers, not monologues

Return ONLY valid JSON:
{
  "subject": "email subject line (empty for text/call)",
  "body": "the full message",
  "tone": "warm" | "professional" | "casual" | "urgent",
  "channel": "email" | "text" | "call",
  "fairHousingCheck": true/false,
  "notes": "any context for the agent about timing or approach"
}`

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const body = await request.json()
  const { contactName, contactType, channel, context, purpose } = body as {
    contactName: string
    contactType?: string
    channel: "email" | "text" | "call"
    context?: string
    purpose: string
  }

  if (!contactName || !channel || !purpose) {
    return NextResponse.json({ error: "contactName, channel, and purpose are required" }, { status: 400 })
  }

  const userContent = `
Draft a ${channel} message for:
- Recipient: ${contactName} (${contactType || "contact"})
- Channel: ${channel}
- Purpose: ${purpose}
${context ? `- Additional context: ${context}` : ""}
- Agent: Caleb Jackson, Reve REALTORS, Baton Rouge LA
`.trim()

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const draft = JSON.parse(clean)

    return NextResponse.json({
      draft,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[Communications] Draft generation failed:", err)
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 })
  }
}
