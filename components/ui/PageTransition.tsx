"use client"

import { useEffect, useState } from "react"

export function PageTransition({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Trigger on next frame so the initial state renders first
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
      }}
    >
      {children}
    </div>
  )
}
