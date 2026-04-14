// SectionLabel — editorial numbered section header. Shared across every
// brief-style surface: morning brief, /aire, /airsign. Keeps 01 / 02 / 03
// rhythm consistent.
//
// Usage:
//   <SectionLabel number="01" title="Pipeline" />
//   <SectionLabel number="02" title="Today's actions" count={3} />

type Props = {
  number: string
  title: string
  count?: number
  rightSlot?: React.ReactNode
}

export function SectionLabel({ number, title, count, rightSlot }: Props) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-[#9aab7e]/50">{number}</span>
      <h2 className="font-[family-name:var(--font-cormorant)] text-[#1e2416] text-lg tracking-wide">
        {title}
      </h2>
      {count !== undefined && (
        <span className="font-mono text-[10px] text-[#6b7d52]/35">({count})</span>
      )}
      <div className="flex-1 h-px bg-[#e8e4d8]/60" />
      {rightSlot}
    </div>
  )
}
