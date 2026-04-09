/**
 * Transcript → Tasks Parser
 *
 * Takes a raw transcript (meeting notes, voice memo, call recording text)
 * and uses Claude to extract structured, actionable tasks from it.
 */

import Anthropic from "@anthropic-ai/sdk"
import type { ClickUpTask } from "@/lib/clickup"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ParsedTask {
  name: string
  description: string
  priority: 1 | 2 | 3 | 4
  due_date?: string // ISO date string (optional, only if mentioned)
  tags: string[]
}

export interface TranscriptParseResult {
  tasks: ParsedTask[]
  summary: string
}

/**
 * Parse a transcript and extract actionable tasks using Claude.
 */
export async function parseTranscript(transcript: string): Promise<TranscriptParseResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a task extraction assistant. Analyze the following transcript and extract every actionable task, to-do, follow-up, or commitment mentioned.

For each task, provide:
- **name**: A clear, concise task title (imperative form, e.g. "Schedule inspection for 123 Main St")
- **description**: Additional context from the transcript that helps the assignee understand what needs to be done
- **priority**: 1=Urgent, 2=High, 3=Normal, 4=Low (infer from tone, deadlines, and language used)
- **due_date**: ISO date string if a specific date or timeframe is mentioned, otherwise omit. Today is ${new Date().toISOString().split("T")[0]}.
- **tags**: Relevant category tags (e.g. "follow-up", "client", "inspection", "financing", "legal", "documentation")

Also provide a brief 1-2 sentence summary of the transcript.

Respond with ONLY valid JSON in this exact format:
{
  "summary": "Brief summary of the transcript",
  "tasks": [
    {
      "name": "Task title",
      "description": "Context and details",
      "priority": 3,
      "due_date": "2026-04-15",
      "tags": ["tag1", "tag2"]
    }
  ]
}

If no actionable tasks are found, return an empty tasks array.

TRANSCRIPT:
${transcript}`,
      },
    ],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("Failed to parse task extraction response")
  }

  const parsed = JSON.parse(jsonMatch[0]) as TranscriptParseResult
  return parsed
}

/**
 * Convert parsed tasks to ClickUp task format.
 */
export function toClickUpTasks(parsed: ParsedTask[]): ClickUpTask[] {
  return parsed.map((t) => ({
    name: t.name,
    description: t.description,
    priority: t.priority,
    due_date: t.due_date ? new Date(t.due_date).getTime() : undefined,
    tags: t.tags,
  }))
}
