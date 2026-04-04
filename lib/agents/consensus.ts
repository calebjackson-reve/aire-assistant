import Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"

export type ConsensusFeature =
  | "compliance_check"
  | "voice_intent"
  | "document_extraction"
  | "cma_comp_selection"
  | "email_classification"
  | "custom"

export interface ConsensusOptions {
  feature: ConsensusFeature
  agentId: string
  systemPrompt: string
  userContent: string
  runs?: number
  threshold?: number
  compareKey?: string
  temperatures?: readonly number[] | number[]
  maxTokens?: number
  skipLogging?: boolean
}

export interface ConsensusResult {
  agreed: boolean
  confidence: number
  output: Record<string, unknown> | null
  agreedValue: string | null
  outputs: Array<Record<string, unknown> | null>
  rawOutputs: string[]
  processingMs: number
  logId: string | null
}

export async function consensusCheck(options: ConsensusOptions): Promise<ConsensusResult> {
  const { feature, agentId, systemPrompt, userContent, runs = 3, threshold = 0.67, compareKey, maxTokens = 800, skipLogging = false } = options
  const temperatures = options.temperatures ?? Array.from({ length: runs }, (_, i) => runs === 1 ? 0.3 : 0.1 + (i * 0.6) / Math.max(runs - 1, 1))
  const start = Date.now()
  const anthropic = new Anthropic()
  const rawOutputs: string[] = []
  const parsedOutputs: Array<Record<string, unknown> | null> = []

  const calls = Array.from({ length: runs }, (_, i) =>
    anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature: temperatures[i] ?? 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }).then((res) => res.content[0]?.type === "text" ? res.content[0].text : "").catch((err) => { console.error(`[Consensus] Run ${i + 1} failed:`, err); return "" })
  )

  const results = await Promise.all(calls)
  for (const raw of results) {
    rawOutputs.push(raw)
    try {
      const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      parsedOutputs.push(JSON.parse(clean))
    } catch { parsedOutputs.push(null) }
  }

  const processingMs = Date.now() - start
  const valueCounts: Record<string, number> = {}
  const valueToOutput: Record<string, Record<string, unknown>> = {}

  for (const parsed of parsedOutputs) {
    if (!parsed) continue
    const value = compareKey ? String(parsed[compareKey] ?? "__undefined__") : JSON.stringify(parsed, Object.keys(parsed).sort())
    valueCounts[value] = (valueCounts[value] ?? 0) + 1
    valueToOutput[value] = parsed
  }

  let topValue: string | null = null
  let topCount = 0
  for (const [value, count] of Object.entries(valueCounts)) {
    if (count > topCount) { topCount = count; topValue = value }
  }

  const validRuns = parsedOutputs.filter(Boolean).length
  const confidence = validRuns > 0 ? topCount / validRuns : 0
  const agreed = confidence >= threshold && topValue !== null
  const output = agreed && topValue ? (valueToOutput[topValue] ?? null) : null

  let logId: string | null = null
  if (!skipLogging) {
    try {
      const record = await prisma.consensusLog.create({
        data: { agentId, feature, prompt: userContent.slice(0, 2000), responses: parsedOutputs as any, agreedResult: output as any, confidence, agreed }
      })
      logId = record.id
    } catch (err) { console.error("[Consensus] Failed to write ConsensusLog:", err) }
  }

  return { agreed, confidence, output, agreedValue: topValue, outputs: parsedOutputs, rawOutputs, processingMs, logId }
}

export const CONSENSUS_PRESETS = {
  compliance: { runs: 3, threshold: 0.67, compareKey: "passed", maxTokens: 600, temperatures: [0.1, 0.3, 0.5] },
  voiceIntent: { runs: 3, threshold: 0.67, compareKey: "intent", maxTokens: 500, temperatures: [0.1, 0.2, 0.4] },
  documentExtraction: { runs: 3, threshold: 0.67, compareKey: undefined, maxTokens: 1000, temperatures: [0.0, 0.2, 0.4] },
  cmaCompSelection: { runs: 3, threshold: 0.67, compareKey: "selectedCompIds", maxTokens: 800, temperatures: [0.1, 0.3, 0.5] },
  emailClassification: { runs: 3, threshold: 0.67, compareKey: "classification", maxTokens: 400, temperatures: [0.1, 0.2, 0.3] },
} as const
