"use client"

import { useState, useEffect } from "react"

export function RotatingWords({
  words = ["intelligence", "clarity", "speed", "precision", "confidence"],
  className = "",
}: {
  words?: string[]
  className?: string
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [words.length])

  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      {words.map((word, i) => (
        <span
          key={word}
          className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] absolute left-0"
          style={{
            transform: i === index ? "translateY(0)" : i < index || (index === 0 && i === words.length - 1 && index !== i) ? "translateY(-120%)" : "translateY(120%)",
            opacity: i === index ? 1 : 0,
          }}
        >
          {word}
        </span>
      ))}
      {/* Invisible word for width */}
      <span className="invisible">{words.reduce((a, b) => a.length > b.length ? a : b)}</span>
    </span>
  )
}
