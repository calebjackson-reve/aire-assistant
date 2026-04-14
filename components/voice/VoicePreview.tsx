"use client"

/**
 * VoicePreview — English playback card with Accept / Edit / Cancel.
 *
 * Deterministic preview of what AIRE heard, shown BEFORE any mutating
 * action fires. Agents never generate a contract without seeing their
 * own words echoed back first.
 *
 * Brand: #9aab7e sage, #6b7d52 olive, #f5f2ea cream, Playfair + Space Grotesk.
 * No blue.
 */

interface VoicePreviewProps {
  intent: string
  preview: string
  executing?: boolean
  onAccept: () => void
  onEdit: () => void
  onCancel: () => void
}

export default function VoicePreview({
  intent,
  preview,
  executing = false,
  onAccept,
  onEdit,
  onCancel,
}: VoicePreviewProps) {
  const intentLabel = intent.replace(/_/g, " ")

  return (
    <div
      className="rounded-2xl border shadow-2xl overflow-hidden"
      style={{
        backgroundColor: "#f5f2ea",
        borderColor: "#6b7d52",
      }}
    >
      <div
        className="px-5 py-2 text-[11px] uppercase tracking-[0.18em] font-semibold"
        style={{
          backgroundColor: "#6b7d52",
          color: "#f5f2ea",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        Confirm · {intentLabel}
      </div>

      <div className="px-6 pt-5 pb-4">
        <p
          className="text-[20px] leading-[1.4] italic"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            color: "#1e2416",
            letterSpacing: "-0.01em",
          }}
        >
          {preview}
        </p>
      </div>

      <div
        className="px-6 pb-5 flex items-center gap-3"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <button
          onClick={onAccept}
          disabled={executing}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: "#6b7d52",
            color: "#f5f2ea",
          }}
        >
          {executing ? "Running..." : "Accept"}
        </button>

        <button
          onClick={onEdit}
          disabled={executing}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: "#9aab7e",
            color: "#1e2416",
          }}
        >
          Edit
        </button>

        <button
          onClick={onCancel}
          disabled={executing}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{
            backgroundColor: "transparent",
            color: "#6b7d52",
            border: "1px solid #6b7d52",
          }}
        >
          Cancel
        </button>

        <div className="ml-auto text-[11px] uppercase tracking-wider" style={{ color: "#6b7d52" }}>
          AIRE heard you
        </div>
      </div>
    </div>
  )
}
