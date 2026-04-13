/**
 * GWS Drive Integration
 * Auto-files AIRE documents to structured Google Drive folders via the gws CLI.
 * All operations are best-effort — Drive failures never block AIRE.
 */

import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

const execAsync = promisify(exec)
const GWS = "C:\\Users\\cjjfr\\AppData\\Roaming\\npm\\gws.cmd"

// Root folder name in Google Drive
const DRIVE_ROOT_FOLDER = "AIRE Transactions"

// In-memory folder ID cache to avoid redundant Drive API calls per-process
const folderIdCache = new Map<string, string>()

/**
 * Find or create a folder in Drive by name under a parent.
 * Returns the folder ID, or null on failure.
 */
async function findOrCreateFolder(
  name: string,
  parentId?: string
): Promise<string | null> {
  try {
    // Search for existing folder
    const query = parentId
      ? `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`
      : `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`

    const listCmd = `"${GWS}" drive files list --params ${JSON.stringify(JSON.stringify({ q: query, fields: "files(id,name)" }))}`
    const { stdout: listOut } = await execAsync(listCmd, { timeout: 10000 })
    const listResult = JSON.parse(listOut)

    if (listResult?.files?.length > 0) {
      return listResult.files[0].id as string
    }

    // Create the folder
    const meta: Record<string, unknown> = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    }
    if (parentId) meta.parents = [parentId]

    const createCmd = `"${GWS}" drive files create --json ${JSON.stringify(JSON.stringify(meta))} --params ${JSON.stringify(JSON.stringify({ fields: "id" }))}`
    const { stdout: createOut } = await execAsync(createCmd, { timeout: 10000 })
    const created = JSON.parse(createOut)
    return created?.id ?? null
  } catch (err) {
    console.error(`[GWS/Drive] findOrCreateFolder "${name}" failed:`, err)
    return null
  }
}

/**
 * Ensure the transaction folder exists: AIRE Transactions/{address}-{txId}/
 * Returns { folderId, folderPath } or null on failure.
 */
export async function ensureTransactionFolder(
  propertyAddress: string,
  transactionId: string
): Promise<{ folderId: string; folderPath: string } | null> {
  try {
    // Sanitize folder name: remove special chars, append short txId for uniqueness
    const safeName = propertyAddress.replace(/[<>:"/\\|?*]/g, "").trim()
    const folderName = `${safeName} [${transactionId.slice(-6)}]`
    const folderPath = `${DRIVE_ROOT_FOLDER}/${folderName}`
    const cacheKey = folderPath

    if (folderIdCache.has(cacheKey)) {
      return { folderId: folderIdCache.get(cacheKey)!, folderPath }
    }

    // Step 1: Ensure root "AIRE Transactions" folder
    const rootId = await findOrCreateFolder(DRIVE_ROOT_FOLDER)
    if (!rootId) return null

    // Step 2: Ensure transaction subfolder
    const txFolderId = await findOrCreateFolder(folderName, rootId)
    if (!txFolderId) return null

    folderIdCache.set(cacheKey, txFolderId)
    console.log(`[GWS/Drive] Folder ready: ${folderPath} (${txFolderId})`)
    return { folderId: txFolderId, folderPath }
  } catch (err) {
    console.error("[GWS/Drive] ensureTransactionFolder failed:", err)
    return null
  }
}

/**
 * Upload a document (from a URL or buffer) to the transaction's Drive folder.
 * Returns the Drive file ID, or null on failure.
 */
export async function uploadDocumentToDrive(params: {
  fileUrl: string
  fileName: string
  docType: string
  transactionId: string
  propertyAddress: string
}): Promise<{ driveFileId: string; driveFolderPath: string } | null> {
  const { fileUrl, fileName, docType, transactionId, propertyAddress } = params
  let tmpPath: string | null = null

  try {
    // Step 1: Ensure the transaction folder exists
    const folder = await ensureTransactionFolder(propertyAddress, transactionId)
    if (!folder) return null

    // Step 2: Download the file from Vercel Blob to a temp file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      console.error(`[GWS/Drive] Failed to fetch file from Blob: ${response.status}`)
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    tmpPath = join(tmpdir(), `aire-upload-${Date.now()}-${fileName}`)
    await writeFile(tmpPath, buffer)

    // Step 3: Upload to Drive in the transaction folder
    const mimeType = fileName.endsWith(".pdf")
      ? "application/pdf"
      : fileName.match(/\.(png|jpg|jpeg)$/i)
        ? `image/${fileName.split(".").pop()}`
        : "application/octet-stream"

    const meta = JSON.stringify({
      name: `[${docType}] ${fileName}`,
      parents: [folder.folderId],
    })

    const uploadCmd = `"${GWS}" drive files create --json ${JSON.stringify(meta)} --upload "${tmpPath}" --params ${JSON.stringify(JSON.stringify({ fields: "id,name,webViewLink" }))}`
    const { stdout } = await execAsync(uploadCmd, { timeout: 30000 })
    const result = JSON.parse(stdout)

    if (result?.id) {
      console.log(`[GWS/Drive] Uploaded "${fileName}" → Drive ID: ${result.id}`)
      return { driveFileId: result.id, driveFolderPath: folder.folderPath }
    }

    return null
  } catch (err) {
    console.error("[GWS/Drive] uploadDocumentToDrive failed (non-blocking):", err)
    return null
  } finally {
    // Clean up temp file
    if (tmpPath) unlink(tmpPath).catch(() => {})
  }
}

/**
 * Get a shareable Drive folder link for a transaction.
 * Returns the web URL or null on failure.
 */
export async function getTransactionFolderUrl(
  propertyAddress: string,
  transactionId: string
): Promise<string | null> {
  try {
    const folder = await ensureTransactionFolder(propertyAddress, transactionId)
    if (!folder) return null
    return `https://drive.google.com/drive/folders/${folder.folderId}`
  } catch {
    return null
  }
}
