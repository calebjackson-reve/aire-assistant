/**
 * AIRE — Job run query functions
 * Every automated job creates a job_run record before doing any work.
 */

import { query } from '../client'

export type JobStatus = 'running' | 'success' | 'partial' | 'failed'

export interface JobRun {
  id: string
  job_name: string
  source: string | null
  status: JobStatus
  started_at: Date
  completed_at: Date | null
  records_attempted: number
  records_imported: number
  records_skipped: number
  records_errored: number
  summary: Record<string, unknown> | null
  triggered_by: string
}

export interface JobRunCounters {
  records_attempted?: number
  records_imported?: number
  records_skipped?: number
  records_errored?: number
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createJobRun(
  jobName: string,
  source?: string,
  triggeredBy: 'scheduler' | 'manual' | 'webhook' = 'scheduler'
): Promise<JobRun> {
  const { rows } = await query<JobRun>(
    `INSERT INTO job_runs (job_name, source, status, triggered_by)
     VALUES ($1, $2, 'running', $3)
     RETURNING *`,
    [jobName, source ?? null, triggeredBy]
  )
  return rows[0]
}

// ── Complete ──────────────────────────────────────────────────────────────────

export async function completeJobRun(
  jobRunId: string,
  status: JobStatus,
  counters: JobRunCounters,
  summary?: Record<string, unknown>
): Promise<void> {
  await query(
    `UPDATE job_runs SET
       status             = $1,
       completed_at       = NOW(),
       records_attempted  = $2,
       records_imported   = $3,
       records_skipped    = $4,
       records_errored    = $5,
       summary            = $6
     WHERE id = $7`,
    [
      status,
      counters.records_attempted ?? 0,
      counters.records_imported ?? 0,
      counters.records_skipped ?? 0,
      counters.records_errored ?? 0,
      summary ? JSON.stringify(summary) : null,
      jobRunId,
    ]
  )
}

// ── Log error ─────────────────────────────────────────────────────────────────

export async function logError(opts: {
  jobRunId?: string
  errorType: string
  source?: string
  rawRecord?: Record<string, unknown>
  addressRaw?: string
  errorMessage: string
  stackTrace?: string
}): Promise<void> {
  await query(
    `INSERT INTO error_logs
       (job_run_id, error_type, source, raw_record, address_raw, error_message, stack_trace)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      opts.jobRunId ?? null,
      opts.errorType,
      opts.source ?? null,
      opts.rawRecord ? JSON.stringify(opts.rawRecord) : null,
      opts.addressRaw ?? null,
      opts.errorMessage,
      opts.stackTrace ?? null,
    ]
  )
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getRecentJobRuns(limit = 20): Promise<JobRun[]> {
  const { rows } = await query<JobRun>(
    `SELECT * FROM job_runs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  )
  return rows
}

export async function getJobRunsByName(jobName: string, limit = 10): Promise<JobRun[]> {
  const { rows } = await query<JobRun>(
    `SELECT * FROM job_runs WHERE job_name = $1 ORDER BY started_at DESC LIMIT $2`,
    [jobName, limit]
  )
  return rows
}

export async function getRecentErrors(limit = 20): Promise<Array<{
  id: string; job_run_id: string; error_type: string; source: string;
  address_raw: string; error_message: string; created_at: Date
}>> {
  const { rows } = await query(
    `SELECT id, job_run_id, error_type, source, address_raw, error_message, created_at
     FROM error_logs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  )
  return rows as never
}

/** Returns source freshness: when was each source last successfully updated? */
export async function getSourceFreshness(): Promise<Array<{
  source: string; last_success: Date | null; last_status: string
}>> {
  const { rows } = await query(
    `SELECT DISTINCT ON (source)
       source,
       completed_at AS last_success,
       status AS last_status
     FROM job_runs
     WHERE source IS NOT NULL
     ORDER BY source, started_at DESC`
  )
  return rows as never
}
