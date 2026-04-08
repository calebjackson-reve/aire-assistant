/**
 * AIRE Circuit Breaker — Automatic fallback when AI services fail.
 * Wraps AI calls with retry logic and graceful degradation.
 */

import { shouldCircuitBreak, logError } from "./error-memory"

interface CircuitBreakerOptions {
  agentName: string
  maxRetries?: number
  retryDelayMs?: number
  fallback?: () => Promise<unknown>
}

/**
 * Execute a function with circuit breaker protection.
 * If the agent has had too many recent errors, skip to fallback immediately.
 * Otherwise, try the primary function with retries, then fallback.
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions
): Promise<{ result: T; source: "primary" | "fallback" } | { error: string; source: "failed" }> {
  const { agentName, maxRetries = 2, retryDelayMs = 1000, fallback } = options

  // Check circuit breaker first
  const isOpen = await shouldCircuitBreak(agentName)
  if (isOpen && fallback) {
    try {
      const result = await fallback() as T
      return { result, source: "fallback" }
    } catch {
      return { error: `${agentName} circuit breaker open and fallback failed`, source: "failed" }
    }
  }

  // Try primary with retries
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      return { result, source: "primary" }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      await logError({
        agentName,
        error: lastError,
        context: { attempt, maxRetries },
      })

      // Don't retry permanent errors
      if (/required|missing|invalid|not found/i.test(lastError.message)) break

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * Math.pow(2, attempt)))
      }
    }
  }

  // Try fallback
  if (fallback) {
    try {
      const result = await fallback() as T
      return { result, source: "fallback" }
    } catch {
      // Fallback also failed
    }
  }

  return { error: lastError?.message || "Unknown error", source: "failed" }
}
