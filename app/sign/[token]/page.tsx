// app/sign/[token]/page.tsx
// Public signing page — no auth required. Token is the auth.
// Loads envelope, shows PDF with fields, captures signatures.

import { SigningFlow } from "./SigningFlow"

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <div className="min-h-screen bg-[#1e2416]">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-[#9aab7e] flex items-center justify-center">
            <span className="text-[#1e2416] text-xs font-bold">A</span>
          </div>
          <div>
            <p className="text-[#e8e4d8] text-sm font-medium">AirSign</p>
            <p className="text-[#e8e4d8]/50 text-xs">Secure Electronic Signatures</p>
          </div>
        </div>
        <SigningFlow token={token} />
      </div>
    </div>
  )
}
