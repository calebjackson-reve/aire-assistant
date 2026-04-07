// app/api/airsign/upload/route.ts
// Upload PDF to Vercel Blob for AirSign envelopes.

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { put } from "@vercel/blob"
import { PDFDocument } from "pdf-lib"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const filename = req.nextUrl.searchParams.get("filename") ?? "document.pdf"
  const body = await req.blob()

  if (body.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }

  if (body.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })
  }

  try {
    const blob = await put(`airsign/uploads/${userId}/${Date.now()}-${filename}`, body, {
      access: "public",
      contentType: "application/pdf",
    })

    // Extract page count + title from PDF
    let pageCount = 0
    let suggestedName = ""
    try {
      const arrayBuffer = await body.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      pageCount = pdfDoc.getPageCount()

      // Try PDF metadata title first
      const pdfTitle = pdfDoc.getTitle()
      if (pdfTitle && pdfTitle.trim().length > 3) {
        suggestedName = pdfTitle.trim()
      }
    } catch {
      console.warn("[AirSign Upload] Could not read PDF metadata")
    }

    // Fall back to cleaned-up filename if no PDF title
    if (!suggestedName) {
      suggestedName = filename
        .replace(/\.pdf$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
    }

    return NextResponse.json({ url: blob.url, size: body.size, pageCount, suggestedName, filename })
  } catch (err) {
    console.error("[AirSign Upload] Failed:", err)
    return NextResponse.json(
      { error: "Upload failed. Ensure BLOB_READ_WRITE_TOKEN is configured." },
      { status: 500 }
    )
  }
}
