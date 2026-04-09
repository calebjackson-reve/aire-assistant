/**
 * Paragon MLS Auto-Upload
 *
 * Uploads a complete listing to Paragon MLS via their RETS/Web API.
 * Handles field mapping, photo upload, and status activation.
 *
 * Note: Paragon MLS access requires an active RETS feed agreement
 * with the Greater Baton Rouge Association of REALTORS (GBRAR).
 *
 * Required env vars:
 *   PARAGON_RETS_URL — RETS server URL
 *   PARAGON_RETS_USERNAME — Agent's RETS login
 *   PARAGON_RETS_PASSWORD — Agent's RETS password
 *   PARAGON_AGENT_ID — Agent's MLS ID
 */

import { PARAGON_FIELDS } from "@/lib/paragon/field-definitions"
import type { MLSAutoFillResult } from "@/lib/paragon/mls-autofill"

export interface MLSUploadPayload {
  transactionId: string
  fields: Record<string, string | number>
  photos?: { url: string; caption?: string; order: number }[]
  description: string
  listPrice: number
  status: "ACTIVE" | "COMING_SOON"
}

export interface MLSUploadResult {
  success: boolean
  mlsNumber?: string
  listingId?: string
  error?: string
  fieldsSubmitted: number
  photosUploaded: number
}

function getConfig() {
  const url = process.env.PARAGON_RETS_URL
  const username = process.env.PARAGON_RETS_USERNAME
  const password = process.env.PARAGON_RETS_PASSWORD
  const agentId = process.env.PARAGON_AGENT_ID
  if (!url || !username || !password) return null
  return { url, username, password, agentId }
}

export function isParagonConfigured(): boolean {
  return getConfig() !== null
}

/**
 * Map AIRE field names to Paragon field numbers.
 */
function mapToParagonFields(fields: Record<string, string | number>): Record<string, string> {
  const mapped: Record<string, string> = {}

  for (const [key, value] of Object.entries(fields)) {
    // Find matching Paragon field
    const paragonField = PARAGON_FIELDS.find(
      (f) => f.name.toLowerCase() === key.toLowerCase() ||
             f.extractionKey === key
    )
    if (paragonField) {
      mapped[`Field_${paragonField.paragonNumber}`] = String(value)
    }
  }

  return mapped
}

/**
 * Upload a listing to Paragon MLS.
 *
 * Flow:
 * 1. Authenticate with RETS server
 * 2. Create listing record with all fields
 * 3. Upload photos in order
 * 4. Set status to ACTIVE
 * 5. Return MLS number
 */
export async function uploadToParagon(payload: MLSUploadPayload): Promise<MLSUploadResult> {
  const config = getConfig()

  if (!config) {
    return {
      success: false,
      error: "Paragon MLS credentials not configured. Set PARAGON_RETS_URL, PARAGON_RETS_USERNAME, and PARAGON_RETS_PASSWORD in your environment.",
      fieldsSubmitted: 0,
      photosUploaded: 0,
    }
  }

  try {
    // Map fields to Paragon format
    const paragonFields = mapToParagonFields(payload.fields)
    paragonFields.ListPrice = String(payload.listPrice)
    paragonFields.AgentRemarks = payload.description
    paragonFields.Status = payload.status === "COMING_SOON" ? "C" : "A"
    if (config.agentId) paragonFields.ListAgentMLSID = config.agentId

    // RETS AddObject request
    const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64")

    const res = await fetch(`${config.url}/Property/Residential`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        fields: paragonFields,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return {
        success: false,
        error: `Paragon API ${res.status}: ${errBody}`,
        fieldsSubmitted: Object.keys(paragonFields).length,
        photosUploaded: 0,
      }
    }

    const result = await res.json()
    const mlsNumber = result.ListingID || result.MLSNumber || result.id

    // Upload photos if provided
    let photosUploaded = 0
    if (payload.photos && mlsNumber) {
      for (const photo of payload.photos) {
        try {
          const photoRes = await fetch(`${config.url}/Property/Residential/${mlsNumber}/Photo`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: photo.url,
              caption: photo.caption || "",
              order: photo.order,
            }),
          })
          if (photoRes.ok) photosUploaded++
        } catch {
          console.error(`[Paragon] Photo upload failed for order ${photo.order}`)
        }
      }
    }

    return {
      success: true,
      mlsNumber: mlsNumber ? String(mlsNumber) : undefined,
      listingId: result.id ? String(result.id) : undefined,
      fieldsSubmitted: Object.keys(paragonFields).length,
      photosUploaded,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      fieldsSubmitted: 0,
      photosUploaded: 0,
    }
  }
}

/**
 * Build upload payload from MLS autofill result + transaction data.
 */
export function buildUploadPayload(
  transactionId: string,
  mlsResult: MLSAutoFillResult,
  description: string,
  listPrice: number,
  photos?: { url: string; caption?: string; order: number }[]
): MLSUploadPayload {
  const fields: Record<string, string | number> = {}

  for (const field of mlsResult.filled) {
    fields[field.fieldName] = field.value
  }

  return {
    transactionId,
    fields,
    photos,
    description,
    listPrice,
    status: "ACTIVE",
  }
}
