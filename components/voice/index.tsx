"use client"

// Wispr voice shell — mount once in a root layout. Renders the side button,
// top-edge indicator, and toast stack. All state lives in WisprProvider.

import { WisprProvider } from "./WisprProvider"
import { WisprButton } from "./WisprButton"
import { WisprIndicator } from "./WisprIndicator"
import { WisprToastStack } from "./WisprToast"

export function WisprShell({ children }: { children: React.ReactNode }) {
  return (
    <WisprProvider>
      <WisprIndicator />
      {children}
      <WisprButton />
      <WisprToastStack />
    </WisprProvider>
  )
}

export { WisprProvider } from "./WisprProvider"
export { useWispr } from "./WisprProvider"
export { WisprButton } from "./WisprButton"
export { WisprIndicator } from "./WisprIndicator"
export { WisprToastStack } from "./WisprToast"
