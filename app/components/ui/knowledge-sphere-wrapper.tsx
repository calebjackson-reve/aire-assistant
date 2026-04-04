"use client"

import dynamic from "next/dynamic"

const KnowledgeSphere = dynamic(
  () => import("./knowledge-sphere").then((m) => ({ default: m.KnowledgeSphere })),
  { ssr: false }
)

export function KnowledgeSphereWrapper({ className }: { className?: string }) {
  return <KnowledgeSphere className={className} />
}
