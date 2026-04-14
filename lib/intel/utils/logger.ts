/**
 * AIRE Intelligence — Structured Job Logger
 *
 * Wraps every automated job with:
 *  - DB job_run record creation and completion
 *  - Per-record error logging to error_logs
 *  - Console output with job context prefix
 *  - Counter tracking (attempted, imported, skipped, errored)
 *
 * Usage:
 *   const job = await createJobLogger('mls-ingestion', 'mls')
 *   job.info('Processing file', { file: 'listings.csv' })
 *   job.countImported()
 *   await job.complete('success')
 */

import { createJobRun, completeJobRun, logError, JobStatus } from '../db/queries/jobs'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogMeta {
  [key: string]: unknown
}

export interface JobLogger {
  jobRunId: string
  jobName: string

  // Logging
  info(message: string, meta?: LogMeta): void
  warn(message: string, meta?: LogMeta): void
  error(message: string, meta?: LogMeta): void

  // Record error to error_logs table + console
  recordError(opts: {
    errorType: string
    errorMessage: string
    addressRaw?: string
    rawRecord?: Record<string, unknown>
    error?: Error
  }): Promise<void>

  // Counters
  countAttempted(n?: number): void
  countImported(n?: number): void
  countSkipped(n?: number): void
  countErrored(n?: number): void
  getCounters(): { attempted: number; imported: number; skipped: number; errored: number }

  // Finalize the job_run record
  complete(status: JobStatus, summary?: Record<string, unknown>): Promise<void>
  fail(error: Error, summary?: Record<string, unknown>): Promise<void>
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a JobLogger. Call this at the START of every job before any work.
 * The job_run record is created immediately with status = 'running'.
 *
 * @example
 *   const job = await createJobLogger('nightly-scoring', undefined, 'scheduler')
 *   try {
 *     // ... do work ...
 *     await job.complete('success', { properties_scored: 142 })
 *   } catch (err) {
 *     await job.fail(err as Error)
 *   }
 */
export async function createJobLogger(
  jobName: string,
  source?: string,
  triggeredBy: 'scheduler' | 'manual' | 'webhook' = 'scheduler'
): Promise<JobLogger> {
  const jobRun = await createJobRun(jobName, source, triggeredBy)
  const jobRunId = jobRun.id

  const counters = { attempted: 0, imported: 0, skipped: 0, errored: 0 }
  const prefix = `[${jobName}${source ? ':' + source : ''}]`

  function formatMeta(meta?: LogMeta): string {
    if (!meta || Object.keys(meta).length === 0) return ''
    return ' ' + JSON.stringify(meta)
  }

  const logger: JobLogger = {
    jobRunId,
    jobName,

    info(message: string, meta?: LogMeta) {
      console.log(`${prefix} ${message}${formatMeta(meta)}`)
    },

    warn(message: string, meta?: LogMeta) {
      console.warn(`${prefix} ⚠ ${message}${formatMeta(meta)}`)
    },

    error(message: string, meta?: LogMeta) {
      console.error(`${prefix} ✗ ${message}${formatMeta(meta)}`)
    },

    async recordError({ errorType, errorMessage, addressRaw, rawRecord, error }) {
      this.error(`${errorType}: ${errorMessage}`, { address: addressRaw })
      this.countErrored()
      await logError({
        jobRunId,
        errorType,
        source,
        rawRecord,
        addressRaw,
        errorMessage,
        stackTrace: error?.stack,
      })
    },

    countAttempted(n = 1) { counters.attempted += n },
    countImported(n = 1)  { counters.imported += n },
    countSkipped(n = 1)   { counters.skipped += n },
    countErrored(n = 1)   { counters.errored += n },
    getCounters()         { return { ...counters } },

    async complete(status: JobStatus, summary?: Record<string, unknown>) {
      const c = counters
      this.info(`Complete — status: ${status} | imported: ${c.imported} | skipped: ${c.skipped} | errors: ${c.errored}`)
      await completeJobRun(jobRunId, status, {
        records_attempted: c.attempted,
        records_imported: c.imported,
        records_skipped: c.skipped,
        records_errored: c.errored,
      }, summary)
    },

    async fail(error: Error, summary?: Record<string, unknown>) {
      this.error(`Job failed: ${error.message}`, { stack: error.stack?.slice(0, 300) })
      await completeJobRun(jobRunId, 'failed', {
        records_attempted: counters.attempted,
        records_imported: counters.imported,
        records_skipped: counters.skipped,
        records_errored: counters.errored,
      }, { ...summary, failureReason: error.message })
    },
  }

  logger.info('Job started', { triggered_by: triggeredBy })
  return logger
}

// ── Simple console logger (for scripts that don't need DB) ────────────────────

export const log = {
  info:  (msg: string, meta?: LogMeta) => console.log(`[AIRE] ${msg}`, meta ?? ''),
  warn:  (msg: string, meta?: LogMeta) => console.warn(`[AIRE] ⚠ ${msg}`, meta ?? ''),
  error: (msg: string, meta?: LogMeta) => console.error(`[AIRE] ✗ ${msg}`, meta ?? ''),
}

// ── Retry helper ──────────────────────────────────────────────────────────────

/**
 * Retry an async operation with exponential backoff.
 * Used by MCP fetchers for Zillow/Redfin requests.
 *
 * @example
 *   const result = await withRetry(() => fetchZillowEstimate(address), {
 *     maxAttempts: 3,
 *     baseDelayMs: 3000,
 *     label: 'zillow-fetch',
 *   })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number
    baseDelayMs?: number
    label?: string
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, label = 'operation' } = opts
  const shouldRetry = opts.shouldRetry ?? (() => true)

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxAttempts || !shouldRetry(err)) {
        throw err
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      log.warn(`${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`)
      await sleep(delay)
    }
  }
  throw lastError
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
