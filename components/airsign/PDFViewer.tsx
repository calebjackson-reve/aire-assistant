"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export interface PageDimensions {
  width: number
  height: number
}

interface PDFViewerProps {
  pdfUrl: string
  currentPage: number
  onPageLoad?: (pageCount: number, dimensions: PageDimensions) => void
  scale?: number
  className?: string
}

// Lazy-load pdfjs-dist only on client (avoids DOMMatrix SSR error)
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null
function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      // Use unpkg which reliably mirrors npm versions (cdnjs may lag behind)
      mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`
      return mod
    })
  }
  return pdfjsPromise
}

export function PDFViewer({
  pdfUrl,
  currentPage,
  onPageLoad,
  scale = 1.5,
  className = "",
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null)

  // Load the PDF document once
  useEffect(() => {
    let cancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)
        const pdfjsLib = await getPdfjs()
        const doc = await pdfjsLib.getDocument({
          url: pdfUrl,
          withCredentials: false,
        }).promise
        if (cancelled) return
        pdfDocRef.current = doc
        setPageCount(doc.numPages)
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err, "URL:", pdfUrl)
          setError(`Failed to load PDF: ${err instanceof Error ? err.message : "Unknown error"}`)
        }
      }
    }

    loadPdf()
    return () => { cancelled = true }
  }, [pdfUrl])

  // Render the current page
  const renderPage = useCallback(async () => {
    const doc = pdfDocRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || currentPage < 1 || currentPage > doc.numPages) return

    try {
      setLoading(true)
      const page = await doc.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: ctx, viewport, canvas }).promise

      const dimensions: PageDimensions = {
        width: viewport.width,
        height: viewport.height,
      }

      onPageLoad?.(doc.numPages, dimensions)
      setLoading(false)
    } catch (err) {
      console.error("PDF render error:", err)
      setError("Failed to render page")
      setLoading(false)
    }
  }, [currentPage, scale, onPageLoad])

  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage()
    }
  }, [pageCount, renderPage])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-zinc-900 rounded-xl p-12 ${className}`}>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-xl z-10">
          <p className="text-zinc-400 text-sm">Loading page {currentPage}...</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="rounded-lg shadow-lg"
        style={{ display: "block", maxWidth: "100%" }}
      />
    </div>
  )
}
