'use client'

export function EmailCapture() {
  return (
    <form
      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder="you@email.com"
        className="flex-1 px-5 py-3.5 bg-white/10 border border-white/20 text-[#f9f8f4] text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40 transition"
      />
      <button
        type="submit"
        className="btn-pill bg-[#f9f8f4] text-[#5c6e2e] font-medium hover:bg-white transition shrink-0"
      >
        Get Early Access
      </button>
    </form>
  )
}
