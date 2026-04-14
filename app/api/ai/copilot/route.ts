/**
 * AIRE AI Copilot — streaming chat endpoint
 * POST /api/ai/copilot
 *
 * Accepts deal context + conversation history.
 * Returns server-sent events (text/event-stream) with incremental Claude tokens.
 * Pre-loaded system prompt anchors Claude as the AIRE transaction co-pilot.
 */

import { auth } from "@clerk/nextjs/server"
import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const client = new Anthropic()

interface CopilotMessage {
  role: "user" | "assistant"
  content: string
}

interface DealContext {
  address: string
  city: string
  state: string
  status: string
  buyerName?: string | null
  sellerName?: string | null
  acceptedPrice?: number | null
  closingDate?: string | null
  contractDate?: string | null
  overdueDeadlines: number
  upcomingDeadlines: number
  documentCount: number
}

function buildSystemPrompt(ctx: DealContext): string {
  const price = ctx.acceptedPrice ? `$${ctx.acceptedPrice.toLocaleString()}` : "price not set"
  const closing = ctx.closingDate
    ? new Date(ctx.closingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "closing date not set"
  const contract = ctx.contractDate
    ? new Date(ctx.contractDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "contract date not set"

  return `You are the AIRE AI Copilot — an expert Louisiana real estate transaction coordinator assistant embedded inside the AIRE platform. You are helping Caleb Jackson, a REALTOR at Reve Realtors in Baton Rouge, manage an active transaction.

## This deal
- Property: ${ctx.address}, ${ctx.city}, ${ctx.state}
- Status: ${ctx.status.replace(/_/g, " ").toLowerCase()}
- ${ctx.buyerName ? `Buyer: ${ctx.buyerName}` : "Buyer: not assigned"}
- ${ctx.sellerName ? `Seller: ${ctx.sellerName}` : "Seller: not assigned"}
- Accepted price: ${price}
- Contract date: ${contract}
- Closing date: ${closing}
- Overdue deadlines: ${ctx.overdueDeadlines}
- Upcoming deadlines: ${ctx.upcomingDeadlines}
- Documents on file: ${ctx.documentCount}

## Your role
Answer questions about this deal concisely and accurately. You can:
- Explain Louisiana-specific LREC rules and disclosure requirements
- Help draft communication language for parties
- Suggest next actions based on deal status and deadline pressure
- Explain what happens if a deadline is missed
- Calculate days remaining / risk levels
- Flag compliance concerns

## Rules
- Be concise. Caleb is busy — 2–4 sentences unless a step-by-step is clearly needed.
- Never invent contact info, prices, or dates not given above.
- Louisiana context always: parish property tax, flood zone, LREC forms, Residential Property Disclosure.
- If asked to write a message or email, produce it directly in a format ready to copy-paste.
- Format lists with short bullets when there are 3+ items.`
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  let body: { messages: CopilotMessage[]; context: DealContext }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 })
  }

  const { messages, context } = body
  if (!messages?.length || !context) {
    return new Response(JSON.stringify({ error: "messages and context required" }), { status: 400 })
  }

  // Build stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        const anthropicStream = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          thinking: { type: "adaptive" },
          system: buildSystemPrompt(context),
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        })

        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Stream error"
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
