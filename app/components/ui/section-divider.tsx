export function SectionDivider() {
  return (
    <div className="relative py-1">
      <div className="flex items-center w-full container-aire">
        {/* Left diamond */}
        <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 10 10" fill="none">
          <rect
            x="5" y="0" width="7.07" height="7.07"
            transform="rotate(45 5 0)"
            fill="none"
            stroke="rgba(122, 140, 60, 0.4)"
            strokeWidth="1"
          />
        </svg>
        {/* Line */}
        <div className="flex-1 h-px bg-gradient-to-r from-sage/20 via-sage/10 to-sage/20" />
        {/* Right diamond */}
        <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 10 10" fill="none">
          <rect
            x="5" y="0" width="7.07" height="7.07"
            transform="rotate(45 5 0)"
            fill="none"
            stroke="rgba(122, 140, 60, 0.4)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  )
}
