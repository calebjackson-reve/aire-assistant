// lib/agents/orchestrator.ts
// Generic parallel researcher orchestrator for the Parent/Researcher/QA pattern.
// Runs N async functions in parallel, collects results keyed by name.

export interface ResearcherResult<T = unknown> {
  name: string
  data: T
  durationMs: number
  error?: string
}

export async function runResearchers<T = unknown>(
  researchers: Array<{ name: string; fn: () => Promise<T> }>
): Promise<ResearcherResult<T>[]> {
  const results = await Promise.allSettled(
    researchers.map(async (r) => {
      const start = Date.now()
      const data = await r.fn()
      return { name: r.name, data, durationMs: Date.now() - start }
    })
  )

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value
    }
    const err = result.reason instanceof Error ? result.reason.message : String(result.reason)
    console.error(`Researcher "${researchers[i].name}" failed:`, err)
    return {
      name: researchers[i].name,
      data: null as T,
      durationMs: 0,
      error: err,
    }
  })
}
