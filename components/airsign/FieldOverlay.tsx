"use client"

export interface OverlayField {
  id: string
  type: "SIGNATURE" | "INITIALS" | "DATE" | "TEXT" | "CHECKBOX"
  label?: string | null
  xPercent: number
  yPercent: number
  widthPercent: number
  heightPercent: number
  signerName?: string
  filled: boolean
  required: boolean
}

interface FieldOverlayProps {
  fields: OverlayField[]
  pageWidth: number
  pageHeight: number
  onFieldClick?: (fieldId: string) => void
  selectedFieldId?: string | null
}

const TYPE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  SIGNATURE: { border: "border-blue-500", bg: "bg-blue-500/15", text: "text-blue-300" },
  INITIALS: { border: "border-purple-500", bg: "bg-purple-500/15", text: "text-purple-300" },
  DATE: { border: "border-amber-500", bg: "bg-amber-500/15", text: "text-amber-300" },
  TEXT: { border: "border-emerald-500", bg: "bg-emerald-500/15", text: "text-emerald-300" },
  CHECKBOX: { border: "border-zinc-400", bg: "bg-zinc-400/15", text: "text-zinc-300" },
}

const TYPE_LABELS: Record<string, string> = {
  SIGNATURE: "Sign",
  INITIALS: "Initials",
  DATE: "Date",
  TEXT: "Text",
  CHECKBOX: "Check",
}

export function FieldOverlay({
  fields,
  pageWidth,
  pageHeight,
  onFieldClick,
  selectedFieldId,
}: FieldOverlayProps) {
  return (
    <div
      className="absolute top-0 left-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {fields.map((field) => {
        const colors = TYPE_COLORS[field.type] || TYPE_COLORS.TEXT
        const isSelected = selectedFieldId === field.id
        const left = (field.xPercent / 100) * pageWidth
        const top = (field.yPercent / 100) * pageHeight
        const width = (field.widthPercent / 100) * pageWidth
        const height = (field.heightPercent / 100) * pageHeight

        return (
          <button
            key={field.id}
            onClick={() => onFieldClick?.(field.id)}
            className={`absolute pointer-events-auto border-2 rounded transition-all cursor-pointer
              ${colors.border} ${colors.bg}
              ${isSelected ? "ring-2 ring-white/50 shadow-lg" : ""}
              ${field.filled ? "opacity-50" : "hover:opacity-90"}
            `}
            style={{ left, top, width, height }}
            title={field.label || `${TYPE_LABELS[field.type]}${field.signerName ? ` — ${field.signerName}` : ""}`}
          >
            {!field.filled && (
              <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide ${colors.text}`}>
                {field.label || TYPE_LABELS[field.type]}
              </span>
            )}
            {field.filled && (
              <span className="absolute inset-0 flex items-center justify-center text-emerald-400 text-xs">
                &#10003;
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
