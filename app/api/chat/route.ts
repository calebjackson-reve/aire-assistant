import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import prisma from "@/lib/prisma"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are AIRE, an AI assistant built into the AIRE Intelligence platform — a real estate operating system for Louisiana agents.

You help real estate agents with:
- Transaction management (deadlines, documents, compliance)
- Market analysis (CMAs, property valuations, neighborhood data)
- Louisiana-specific real estate law and LREC regulations
- Deal strategy and negotiation advice
- Daily workflow and pipeline management

Style:
- Concise, confident, specific
- Lead with the answer, not the reasoning
- Use Louisiana terminology (parish not county, LREC not generic licensing)
- When discussing numbers, be precise
- Warm but professional — like a senior agent mentoring a colleague

You have access to the user's transaction data which will be provided in context. Reference their actual deals when relevant.`

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { messages } = await request.json()
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 })
  }

  // Fetch user context
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      transactions: {
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
        include: {
          deadlines: {
            where: { completedAt: null },
            orderBy: { dueDate: "asc" },
            take: 5,
          },
        },
        take: 10,
      },
    },
  })

  // Build context
  let context = ""
  if (user) {
    context = `\n\nUser: ${user.firstName || ""} ${user.lastName || ""}`
    if (user.brokerageName) context += ` at ${user.brokerageName}`

    if (user.transactions.length > 0) {
      context += `\n\nActive Transactions (${user.transactions.length}):`
      user.transactions.forEach((t) => {
        context += `\n- ${t.propertyAddress} | ${t.status} | List: $${t.listPrice?.toLocaleString() || "N/A"}`
        if (t.closingDate) context += ` | Closing: ${new Date(t.closingDate).toLocaleDateString()}`
        if (t.deadlines.length > 0) {
          t.deadlines.forEach((d) => {
            const daysLeft = Math.ceil((new Date(d.dueDate).getTime() - Date.now()) / 86400000)
            context += `\n  → ${d.name}: ${daysLeft <= 0 ? "OVERDUE" : `${daysLeft} days left`}`
          })
        }
      })
    } else {
      context += "\n\nNo active transactions."
    }
  }

  const systemWithContext = SYSTEM_PROMPT + context

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemWithContext,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          stream: true,
        })

        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (err) {
        console.error("[AIRE Chat]", err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`))
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
