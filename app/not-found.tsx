import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ea] px-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] text-[#6b7d52] tracking-[0.2em] uppercase mb-3">
          404
        </p>
        <h1 className="font-[family-name:var(--font-cormorant)] italic text-[#1e2416] text-4xl mb-3">
          Page not found
        </h1>
        <p className="text-[#6a6a60] text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/aire"
          className="btn-primary inline-block px-6 py-2.5 bg-[#6b7d52] text-[#f5f2ea] rounded-lg text-sm font-medium hover:bg-[#5a6c44] transition-colors no-underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
