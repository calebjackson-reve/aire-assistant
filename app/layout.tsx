import type { Metadata } from "next"
import { Cormorant_Garamond, Space_Grotesk, IBM_Plex_Mono, Syncopate } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import "./globals.css"

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500", "600"],
})

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
})

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
})

const syncopate = Syncopate({
  variable: "--font-syncopate",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: "AIRE Intelligence | AI-Powered Real Estate Platform",
  description:
    "AI-driven real estate intelligence for Baton Rouge. Market analysis, transaction management, voice commands, and automated workflows.",
  openGraph: {
    title: "AIRE Intelligence — AI-Powered Real Estate Tools",
    description: "AI-powered market analytics, flood risk analysis, and deal intelligence built for Baton Rouge real estate.",
    type: "website",
    siteName: "AIRE Intelligence",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIRE Intelligence — AI-Powered Real Estate Tools",
    description: "AI-powered market analytics, flood risk analysis, and deal intelligence built for Baton Rouge real estate.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${cormorant.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${syncopate.variable} antialiased`}>
        <body>
          <div className="aurora-bg" aria-hidden="true" />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
