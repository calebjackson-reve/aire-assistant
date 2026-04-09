/**
 * ClickUp Credential Vault
 *
 * Centralizes all ClickUp-related secrets for the transcript-to-tasks agent.
 * Validates that required credentials are present and provides typed access.
 *
 * Env vars:
 *   CLICKUP_API_TOKEN  — Personal API token (Settings → Apps → API Token)
 *   CLICKUP_LIST_ID    — Default list ID for task creation
 *   CLICKUP_SPACE_ID   — (Optional) Space ID for listing available lists
 *   CLICKUP_TEAM_ID    — (Optional) Workspace/team ID
 */

export interface ClickUpVault {
  apiToken: string
  listId: string | null
  spaceId: string | null
  teamId: string | null
}

/**
 * Load and validate ClickUp credentials from environment.
 * Throws if the required API token is missing.
 */
export function getClickUpVault(): ClickUpVault {
  const apiToken = process.env.CLICKUP_API_TOKEN
  if (!apiToken) {
    throw new Error(
      "CLICKUP_API_TOKEN is not configured. " +
      "Set it in your environment or .env.local. " +
      "Get your token from ClickUp → Settings → Apps → API Token."
    )
  }

  return {
    apiToken,
    listId: process.env.CLICKUP_LIST_ID || null,
    spaceId: process.env.CLICKUP_SPACE_ID || null,
    teamId: process.env.CLICKUP_TEAM_ID || null,
  }
}

/**
 * Check if ClickUp credentials are configured (non-throwing).
 * Useful for UI to show connection status.
 */
export function isClickUpConfigured(): { configured: boolean; missing: string[] } {
  const missing: string[] = []
  if (!process.env.CLICKUP_API_TOKEN) missing.push("CLICKUP_API_TOKEN")
  if (!process.env.CLICKUP_LIST_ID) missing.push("CLICKUP_LIST_ID")
  return { configured: missing.length === 0, missing }
}
