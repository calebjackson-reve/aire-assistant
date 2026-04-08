/**
 * AIRE Error Memory — Tracks, classifies, and learns from failures.
 * Every error feeds back into the system to prevent recurrence.
 */

import prisma from "@/lib/prisma"

type ErrorType = "transient" | "permanent" | "data_quality" | "prompt_failure"

/**
 * Classify an error automatically based on the error message.
 */
function classifyError(error: Error | string): ErrorType {
  const msg = typeof error === "string" ? error : error.message

  // Transient: API timeouts, rate limits, network failures
  if (/timeout|ECONNREFUSED|ENOTFOUND|rate.?limit|429|503|504/i.test(msg)) {
    return "transient"
  }
  // Data quality: missing fields, invalid input, malformed data
  if (/required|missing|invalid|malformed|null|undefined.*field/i.test(msg)) {
    return "data_quality"
  }
  // Prompt failure: AI returned garbage, couldn't parse, hallucination
  if (/parse|JSON|unexpected token|could not extract|no fields|empty response/i.test(msg)) {
    return "prompt_failure"
  }
  // Default: permanent error
  return "permanent"
}

/**
 * Log an error to the memory system.
 * Deduplicates by error message — increments count if seen before.
 */
export async function logError(params: {
  agentName: string
  error: Error | string
  input?: unknown
  output?: unknown
  context?: Record<string, unknown>
}) {
  const errorMessage = typeof params.error === "string" ? params.error : params.error.message
  const errorType = classifyError(params.error)

  // Check for existing unresolved error with same message
  const existing = await prisma.errorMemory.findFirst({
    where: {
      agentName: params.agentName,
      errorMessage,
      resolved: false,
    },
  })

  if (existing) {
    return prisma.errorMemory.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        context: params.context ? JSON.parse(JSON.stringify(params.context)) : existing.context,
      },
    })
  }

  return prisma.errorMemory.create({
    data: {
      agentName: params.agentName,
      errorType,
      errorMessage,
      input: params.input ? JSON.parse(JSON.stringify(params.input)) : undefined,
      output: params.output ? JSON.parse(JSON.stringify(params.output)) : undefined,
      context: params.context ? JSON.parse(JSON.stringify(params.context)) : undefined,
    },
  })
}

/**
 * Get error patterns for an agent — recurring errors that need attention.
 */
export async function getErrorPatterns(agentName: string, minOccurrences: number = 3) {
  return prisma.errorMemory.findMany({
    where: {
      agentName,
      resolved: false,
      occurrences: { gte: minOccurrences },
    },
    orderBy: { occurrences: "desc" },
    take: 20,
  })
}

/**
 * Mark an error as resolved with the fix description.
 */
export async function resolveError(errorId: string, resolution: string) {
  return prisma.errorMemory.update({
    where: { id: errorId },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolution,
    },
  })
}

/**
 * Check if we should circuit-break an agent (too many errors).
 * Returns true if agent has had 3+ errors in the last 5 minutes.
 */
export async function shouldCircuitBreak(agentName: string): Promise<boolean> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
  const recentErrors = await prisma.errorMemory.count({
    where: {
      agentName,
      createdAt: { gte: fiveMinAgo },
    },
  })
  return recentErrors >= 3
}
