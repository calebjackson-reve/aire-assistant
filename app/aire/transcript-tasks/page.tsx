"use client"

import { useState } from "react"

interface ParsedTask {
  name: string
  description: string
  priority: 1 | 2 | 3 | 4
  due_date?: string
  tags: string[]
}

interface ClickUpResult {
  id: string
  name: string
  url: string
}

interface TaskResult {
  summary: string
  tasks: ParsedTask[]
  clickup: { created: ClickUpResult[]; errors: { task: ParsedTask; error: string }[] } | null
  message: string
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Urgent", color: "bg-red-100 text-red-700 border-red-200" },
  2: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
  3: { label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-200" },
  4: { label: "Low", color: "bg-gray-100 text-gray-600 border-gray-200" },
}

export default function TranscriptTasksPage() {
  const [transcript, setTranscript] = useState("")
  const [listId, setListId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TaskResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!transcript.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/transcript/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          listId: listId.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Something went wrong")
        return
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl italic text-[#1e2416] mb-1">
          Transcript to Tasks
        </h1>
        <p className="text-sm text-[#6b7d52]">
          Paste a meeting transcript, voice memo, or call notes. AIRE extracts tasks and sends them to ClickUp.
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl border border-[#d4c8b8]/40 p-6 mb-6">
        <label className="block text-xs font-mono uppercase tracking-wider text-[#6b7d52] mb-2">
          Transcript
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={10}
          placeholder="Paste your transcript here... e.g. meeting notes, call recording text, voice memo transcription"
          className="w-full rounded-lg border border-[#d4c8b8]/60 bg-[#faf8f4] px-4 py-3 text-sm text-[#1e2416] placeholder:text-[#b0a898] focus:outline-none focus:ring-2 focus:ring-[#6b7d52]/30 focus:border-[#6b7d52] resize-y"
        />

        {/* Optional ClickUp List ID */}
        <div className="mt-4">
          <label className="block text-xs font-mono uppercase tracking-wider text-[#6b7d52] mb-2">
            ClickUp List ID <span className="text-[#b0a898]">(optional — falls back to env var)</span>
          </label>
          <input
            type="text"
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            placeholder="e.g. 901234567"
            className="w-full max-w-xs rounded-lg border border-[#d4c8b8]/60 bg-[#faf8f4] px-4 py-2 text-sm text-[#1e2416] placeholder:text-[#b0a898] focus:outline-none focus:ring-2 focus:ring-[#6b7d52]/30 focus:border-[#6b7d52]"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !transcript.trim()}
          className="mt-5 px-6 py-2.5 rounded-lg bg-[#6b7d52] text-white text-sm font-medium hover:bg-[#5a6c44] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Extracting tasks..." : "Extract & Create Tasks"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-xl border border-[#d4c8b8]/40 p-6">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#6b7d52] mb-2">
              Summary
            </h2>
            <p className="text-sm text-[#1e2416]">{result.summary}</p>
            <p className="text-xs text-[#6b7d52] mt-2">{result.message}</p>
          </div>

          {/* Task List */}
          {result.tasks.length > 0 && (
            <div className="bg-white rounded-xl border border-[#d4c8b8]/40 p-6">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#6b7d52] mb-4">
                Extracted Tasks ({result.tasks.length})
              </h2>
              <div className="space-y-3">
                {result.tasks.map((task, i) => {
                  const pri = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[3]
                  const clickupEntry = result.clickup?.created.find(
                    (c) => c.name === task.name
                  )
                  return (
                    <div
                      key={i}
                      className="border border-[#d4c8b8]/30 rounded-lg p-4 hover:bg-[#faf8f4] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${pri.color}`}>
                              {pri.label}
                            </span>
                            {task.due_date && (
                              <span className="text-[10px] font-mono text-[#6b7d52] bg-[#6b7d52]/10 px-2 py-0.5 rounded">
                                Due {task.due_date}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-medium text-[#1e2416]">
                            {task.name}
                          </h3>
                          <p className="text-xs text-[#6b7d52] mt-1">
                            {task.description}
                          </p>
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {task.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-mono text-[#6b7d52] bg-[#6b7d52]/8 px-1.5 py-0.5 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {clickupEntry && (
                          <a
                            href={clickupEntry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[10px] font-mono text-[#6b7d52] underline hover:text-[#5a6c44]"
                          >
                            View in ClickUp
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ClickUp Errors */}
          {result.clickup && result.clickup.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-amber-700 mb-2">
                ClickUp Errors ({result.clickup.errors.length})
              </h3>
              {result.clickup.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-700">
                  <strong>{e.task.name}:</strong> {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
