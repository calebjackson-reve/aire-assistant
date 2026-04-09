/**
 * ClickUp API Client
 *
 * Creates tasks in ClickUp from structured task data.
 * Credentials sourced from the ClickUp vault (lib/vaults/clickup.ts).
 *
 * Docs: https://clickup.com/api
 */

import { getClickUpVault } from "@/lib/vaults/clickup"

const CLICKUP_API = "https://api.clickup.com/api/v2"

export interface ClickUpTask {
  name: string
  description?: string
  priority?: 1 | 2 | 3 | 4 // 1=Urgent, 2=High, 3=Normal, 4=Low
  due_date?: number // Unix ms
  tags?: string[]
  assignees?: number[]
  status?: string
}

export interface ClickUpCreateResult {
  id: string
  name: string
  url: string
  status: { status: string }
}

function getHeaders() {
  const vault = getClickUpVault()
  return {
    Authorization: vault.apiToken,
    "Content-Type": "application/json",
  }
}

/**
 * Create a single task in a ClickUp list.
 */
export async function createTask(
  listId: string,
  task: ClickUpTask
): Promise<ClickUpCreateResult> {
  const res = await fetch(`${CLICKUP_API}/list/${listId}/task`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(task),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`ClickUp API error ${res.status}: ${body}`)
  }

  return res.json()
}

/**
 * Create multiple tasks in a ClickUp list.
 * Returns results for each task (success or error).
 */
export async function createTasks(
  listId: string,
  tasks: ClickUpTask[]
): Promise<{ created: ClickUpCreateResult[]; errors: { task: ClickUpTask; error: string }[] }> {
  const created: ClickUpCreateResult[] = []
  const errors: { task: ClickUpTask; error: string }[] = []

  for (const task of tasks) {
    try {
      const result = await createTask(listId, task)
      created.push(result)
    } catch (err) {
      errors.push({ task, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { created, errors }
}

/**
 * Fetch available lists in a space (useful for UI list picker).
 */
export async function getLists(spaceId: string) {
  const res = await fetch(`${CLICKUP_API}/space/${spaceId}/list`, {
    headers: getHeaders(),
  })
  if (!res.ok) throw new Error(`ClickUp API error ${res.status}`)
  const data = await res.json()
  return data.lists as { id: string; name: string }[]
}
