"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"

interface Transaction {
  id: string
  propertyAddress: string
  status: string
}

interface UploadResult {
  document: {
    id: string
    classifiedType: string
    extractedData: Record<string, unknown> | null
  }
}

export function DocumentUploader({
  transactions,
}: {
  transactions: Transaction[]
}) {
  const [selectedTransactionId, setSelectedTransactionId] = useState("")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_SIZE = 10 * 1024 * 1024 // 10MB

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Only PDF files are accepted."
    }
    if (file.size > MAX_SIZE) {
      return `File exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB).`
    }
    return null
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError("")
      setUploading(true)
      setResult(null)

      try {
        const formData = new FormData()
        formData.append("file", file)
        if (selectedTransactionId) {
          formData.append("transactionId", selectedTransactionId)
        }

        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Upload failed (${res.status})`)
        }

        const data: UploadResult = await res.json()
        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.")
      } finally {
        setUploading(false)
      }
    },
    [selectedTransactionId]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        uploadFile(file)
      }
    },
    [uploadFile]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        uploadFile(file)
      }
      // Reset input so same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [uploadFile]
  )

  const reset = () => {
    setResult(null)
    setError("")
    setUploading(false)
  }

  const typeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  // Success result view
  if (result) {
    const { document: doc } = result
    const fields = doc.extractedData
      ? Object.entries(doc.extractedData).filter(
          ([, v]) => v !== null && v !== undefined && v !== ""
        )
      : []

    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Link
          href="/aire/documents"
          className="text-cream-dim hover:text-cream text-sm"
        >
          &larr; Back to Documents
        </Link>

        <div className="border border-brown-border rounded-xl p-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <svg
              className="h-8 w-8 text-copper"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl">
              Upload Complete
            </h2>
          </div>

          <div className="mb-4">
            <span className="text-cream-dim text-sm">Document Type</span>
            <div className="mt-1">
              <span className="inline-block bg-copper/20 text-copper text-xs px-2 py-1 rounded">
                {typeLabel(doc.classifiedType)}
              </span>
            </div>
          </div>

          {fields.length > 0 && (
            <div className="mb-6">
              <span className="text-cream-dim text-sm">Extracted Fields</span>
              <div className="mt-2 space-y-2">
                {fields.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-start border-b border-brown-border/50 pb-2"
                  >
                    <span className="text-cream-dim text-sm">
                      {typeLabel(key)}
                    </span>
                    <span className="text-cream text-sm text-right max-w-[60%] break-words">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={reset}
              className="bg-copper hover:bg-copper-light text-forest-deep font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Upload Another
            </button>
            <Link
              href="/aire/documents"
              className="border border-brown-border text-cream-dim hover:text-cream font-medium px-6 py-2.5 rounded-lg transition-colors text-center"
            >
              View Documents
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Link
        href="/aire/documents"
        className="text-cream-dim hover:text-cream text-sm"
      >
        &larr; Back to Documents
      </Link>

      <div className="border border-brown-border rounded-xl p-8 mt-6">
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-cream text-3xl mb-6">
          Upload Document
        </h1>

        {/* Transaction Picker */}
        <div className="mb-6">
          <label className="text-cream-dim text-sm block mb-2">
            File to Transaction (optional)
          </label>
          <select
            value={selectedTransactionId}
            onChange={(e) => setSelectedTransactionId(e.target.value)}
            className="w-full bg-forest-deep border border-brown-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-copper"
          >
            <option value="">No transaction selected</option>
            {transactions.map((tx) => (
              <option key={tx.id} value={tx.id}>
                {tx.propertyAddress} ({tx.status})
              </option>
            ))}
          </select>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragging
              ? "border-copper bg-copper/5"
              : "border-brown-border"
          }`}
        >
          {uploading ? (
            <div>
              <div className="animate-spin h-8 w-8 border-2 border-copper border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-cream-dim text-sm">
                Uploading and classifying document...
              </p>
            </div>
          ) : (
            <>
              <svg
                className="mx-auto h-12 w-12 text-cream-dim mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-cream-dim mb-2">
                Drag and drop your PDF here
              </p>
              <p className="text-cream-dim text-xs mb-4 opacity-60">
                PDF only, 10MB max
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-copper hover:bg-copper-light text-forest-deep font-medium px-6 py-2.5 rounded-lg transition-colors"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-red-400 text-sm mt-3">{error}</p>
        )}
      </div>
    </div>
  )
}
