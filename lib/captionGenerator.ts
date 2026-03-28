export interface CaptionInput {
  hook:              string
  clientDescription: string
  price:             string
  address:           string
  specs:             string
  equityValue?:      string
  milestone:         string
  closingNote:       string
  clientFirstName:   string
}

export function generateCaption(input: CaptionInput): string {
  const {
    hook,
    clientDescription,
    price,
    address,
    specs,
    equityValue,
    milestone,
    closingNote,
    clientFirstName,
  } = input

  const addressParts = address.split('·').map((s: string) => s.trim())
  const city = addressParts[1] || address

  const lines: string[] = []

  // PART 1 — HOOK
  lines.push(`"${hook}"`)
  lines.push('')

  // PART 2 — CLIENT STORY
  lines.push(clientDescription)
  lines.push('')

  // PART 3 — BULLETS
  lines.push(`→ ${price}  ·  ${city}`)
  lines.push(`→ ${specs}`)
  if (equityValue) {
    lines.push(`→ ${equityValue} in equity from Day 1`)
  }
  lines.push(`→ ${milestone}`)
  lines.push('')

  // PART 4 — MEANING CLOSE
  lines.push(closingNote)
  lines.push('')

  // PART 5 — CONGRATULATIONS
  lines.push(`Congratulations ${clientFirstName} — so proud to have been part of this one. 🏡`)

  return lines.join('\n')
}

export function generateHashtags(city: string, dealType: string): string {
  const citySlug = city.replace(/\s+/g, '')

  const base = [
    `#${citySlug}`,
    `#BatonRougeRealEstate`,
    `#LouisianaRealEstate`,
    `#CalebJackson`,
    `#RêveRealtors`,
    `#ClientFirst`,
    `#RealEstateStory`,
  ]

  const dealTags: Record<string, string[]> = {
    'Just Sold':   ['#JustSold', '#JustClosed', '#SoldByCaleb', '#BatonRougeHomes'],
    'Now Pending': ['#NowPending', '#UnderContract', '#ComingSoon', '#BatonRougeHomes'],
    'Just Listed': ['#JustListed', '#NewListing', '#HomesForSale', '#BatonRougeHomes'],
    'Closing Day': ['#ClosingDay', '#NewHomeowners', '#FirstTimeHomeBuyer', '#BuildingWealth'],
  }

  const extra = dealTags[dealType] || dealTags['Just Sold']

  return [...base, ...extra].join(' ')
}