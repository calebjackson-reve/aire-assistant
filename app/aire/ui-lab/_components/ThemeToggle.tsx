"use client"

import { useEffect, useState } from "react"

type Theme = "daylight" | "nocturne"

/** Sun/moon theme swap — persists to localStorage, 240ms cross-fade. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("nocturne")

  useEffect(() => {
    // Mirror whatever the no-FOUC bootstrap script already set on the scope.
    const scope = document.querySelector<HTMLElement>(".ui-lab-scope")
    if (scope) {
      const current = (scope.dataset.theme as Theme) || "nocturne"
      setTheme(current)
    }
  }, [])

  function toggle() {
    const next: Theme = theme === "daylight" ? "nocturne" : "daylight"
    setTheme(next)
    const scope = document.querySelector<HTMLElement>(".ui-lab-scope")
    if (scope) scope.dataset.theme = next
    try {
      localStorage.setItem("aire-theme", next)
    } catch {}
  }

  const isDark = theme === "nocturne"

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "daylight" : "nocturne"} theme`}
      title={`Switch to ${isDark ? "Daylight" : "Nocturne"}`}
      className={`relative w-10 h-10 rounded-md grid place-items-center transition-[transform,color,background-color] duration-[160ms] ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9aab7e] focus-visible:ring-offset-2 ${className}`}
      style={{
        color: "var(--text-on-rail)",
        ["--tw-ring-offset-color" as string]: "var(--surface-rail)",
      }}
    >
      <svg
        className="w-4 h-4 transition-transform duration-[240ms]"
        style={{ transform: isDark ? "rotate(0deg)" : "rotate(180deg)" }}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isDark ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
          </>
        )}
      </svg>
    </button>
  )
}
