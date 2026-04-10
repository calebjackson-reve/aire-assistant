"use client"

export default function AireLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      {/* Shining "AIRE is thinking" text */}
      <div className="relative">
        <h2
          className="text-4xl md:text-5xl font-light italic text-[#1e2416]/10 select-none"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          AIRE is thinking
        </h2>
        <h2
          className="absolute inset-0 text-4xl md:text-5xl font-light italic bg-clip-text text-transparent select-none"
          style={{
            fontFamily: "var(--font-cormorant)",
            backgroundImage: "linear-gradient(90deg, transparent 0%, #6b7d52 45%, #9aab7e 50%, #6b7d52 55%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shine-text 2.5s ease-in-out infinite",
            WebkitBackgroundClip: "text",
          }}
        >
          AIRE is thinking
        </h2>
      </div>

      {/* Subtle dots */}
      <div className="flex gap-1.5 mt-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#9aab7e]/40 animate-bounce [animation-delay:0ms] [animation-duration:1.4s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#9aab7e]/40 animate-bounce [animation-delay:200ms] [animation-duration:1.4s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#9aab7e]/40 animate-bounce [animation-delay:400ms] [animation-duration:1.4s]" />
      </div>

      <style jsx>{`
        @keyframes shine-text {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
