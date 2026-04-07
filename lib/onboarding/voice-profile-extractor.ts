/**
 * AIRE Voice Profile Extractor
 *
 * Reads the user's last 45 days of SENT emails, analyzes their writing style
 * with Claude, and produces a structured voice profile stored on User.voiceProfile.
 *
 * This profile is injected into every draft-reply system prompt so AI replies
 * sound like the agent, not like generic AI.
 */

import prisma from "@/lib/prisma"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface VoiceProfile {
  greeting: string // "Hey [name]," vs "Good morning [name]," vs "Hi [name] —"
  signOff: string // "Best, Caleb" vs "Thanks, C" vs "Talk soon, Caleb Jackson"
  avgSentenceLength: number // words
  tone: string // "warm casual" | "formal professional" | "direct concise"
  vocabularyQuirks: string[] // e.g. ["y'all", "appreciate you", "let me know"]
  examples: { subject: string; snippet: string }[] // 3 real samples
  sourceCount: number // how many sent emails analyzed
  analyzedAt: string // ISO date
}

interface SentEmail {
  subject: string
  body: string // plain text, first ~500 chars
}

const SYSTEM_PROMPT = `You are a writing-style analyst. Given a set of a real estate agent's SENT emails, produce a structured voice profile that captures how they write.

Focus on PATTERNS, not content. Extract:
- greeting: exact greeting they use most often (e.g. "Hey [name],", "Good morning [name],")
- signOff: exact sign-off they use most often (e.g. "Best, Caleb", "Talk soon,")
- avgSentenceLength: rough average in words
- tone: one phrase — "warm casual", "formal professional", "direct concise", "friendly detailed", etc.
- vocabularyQuirks: 3-8 distinctive words or phrases they use (e.g. "y'all", "appreciate you", "let me know")

Return ONLY valid JSON in this exact shape:
{"greeting":"...","signOff":"...","avgSentenceLength":20,"tone":"...","vocabularyQuirks":["..."]}`

export async function extractVoiceProfile(opts: {
  userId: string
  sentEmails: SentEmail[]
}): Promise<VoiceProfile | null> {
  const { userId, sentEmails } = opts

  if (sentEmails.length < 3) {
    console.log(`[VoiceProfile] user=${userId} skipped — only ${sentEmails.length} sent emails`)
    return null
  }

  // Build sample corpus — cap at 20 emails, ~500 chars each, to stay in token budget
  const samples = sentEmails
    .slice(0, 20)
    .map((e, i) => `---\nEmail ${i + 1}\nSubject: ${e.subject}\n${e.body.slice(0, 500)}`)
    .join("\n\n")

  try {
    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: samples }],
    })

    const text = res.content[0]?.type === "text" ? res.content[0].text : "{}"
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    const parsed = JSON.parse(cleaned)

    const profile: VoiceProfile = {
      greeting: parsed.greeting || "Hi,",
      signOff: parsed.signOff || "Best,",
      avgSentenceLength: parsed.avgSentenceLength || 18,
      tone: parsed.tone || "professional",
      vocabularyQuirks: Array.isArray(parsed.vocabularyQuirks) ? parsed.vocabularyQuirks : [],
      examples: sentEmails.slice(0, 3).map((e) => ({
        subject: e.subject,
        snippet: e.body.slice(0, 200),
      })),
      sourceCount: sentEmails.length,
      analyzedAt: new Date().toISOString(),
    }

    // Persist to User.voiceProfile (JSON field)
    await prisma.user.update({
      where: { id: userId },
      data: { voiceProfile: JSON.parse(JSON.stringify(profile)) },
    })

    console.log(
      `[VoiceProfile] user=${userId} extracted from ${sentEmails.length} emails — tone="${profile.tone}", greeting="${profile.greeting}"`
    )
    return profile
  } catch (err) {
    console.error(`[VoiceProfile] user=${userId} extraction failed:`, err)
    return null
  }
}

/**
 * Render the voice profile into a system-prompt snippet that can be injected
 * into any Claude draft-reply call. This is the bridge from "extracted profile"
 * to "AI replies that sound like you".
 */
export function voiceProfileToPrompt(profile: VoiceProfile | null): string {
  if (!profile) return ""

  return `
WRITING STYLE (match this voice — do not use generic AI phrasing):
- Greeting style: ${profile.greeting}
- Sign-off: ${profile.signOff}
- Average sentence length: ~${profile.avgSentenceLength} words (match this rhythm)
- Overall tone: ${profile.tone}
- Distinctive phrases to use naturally: ${profile.vocabularyQuirks.join(", ")}

Write as if you are this person. Do not introduce new phrases or a different voice. If unsure, err toward shorter sentences and the agent's exact greeting/sign-off.
`.trim()
}
