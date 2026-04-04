// app/airsign/layout.tsx
// ⚠️ ERR-003 PREVENTION: NO auth() call here.
// Auth is handled in each page individually.
// Putting auth.protect() in a layout kills the root /airsign route.

export default function AirSignLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
