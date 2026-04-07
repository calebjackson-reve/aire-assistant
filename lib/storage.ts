import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'

// Simple local file storage (replace with GCS/S3 in production)
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function uploadFile(
  file: File,
  category: 'documents' | 'images'
): Promise<{ url: string; key: string }> {
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Generate unique filename
  const ext = file.name.split('.').pop()
  const key = `${category}/${uuidv4()}.${ext}`
  const filePath = path.join(UPLOAD_DIR, key)

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  // Write file
  await fs.writeFile(filePath, buffer)

  return {
    url: `/uploads/${key}`,
    key,
  }
}

export async function getFile(key: string): Promise<Buffer> {
  const filePath = path.join(UPLOAD_DIR, key)
  return fs.readFile(filePath)
}
