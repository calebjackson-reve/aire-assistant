/**
 * AIRE Intelligence — Static Market Data
 * Baton Rouge metro stats, neighborhood heat scores, commercial data.
 * Updated quarterly from GBRAR MLS, Redfin, NAR, PropStream.
 */

export const AIRE_DATA = {
  sources: {
    gbrar: { name: 'GBRAR MLS InfoSparks', date: 'Feb 2026', url: 'https://gbrar.com' },
    redfin: { name: 'Redfin Data Center', date: 'Dec 2025', url: 'https://redfin.com/news/data-center' },
    nar: { name: 'NAR Housing Statistics', date: 'Feb 2026', url: 'https://nar.realtor/research-and-statistics' },
    louisiana_realtors: { name: 'Louisiana REALTORS / ShowingTime', date: 'Feb 2025', url: 'https://louisiana.stats.showingtime.com' },
    attom: { name: 'ATTOM Property Data', date: 'Nov 2025', url: 'https://attomdata.com' },
    fema: { name: 'FEMA NFHL', date: 'Current', url: 'https://msc.fema.gov' },
    census: { name: 'US Census ACS', date: '2023 5-yr', url: 'https://data.census.gov' },
    hud: { name: 'HUD FMR 2025', date: 'Oct 2025', url: 'https://huduser.gov' },
    lacdb: { name: 'LACDB Commercial', date: 'Current', url: 'https://lacdb.com' },
    crexi: { name: 'CREXi Intelligence', date: 'Current', url: 'https://crexi.com' },
    propstream: { name: 'PropStream', date: 'Current', url: 'https://propstream.com' },
    brOpenData: { name: 'Baton Rouge Open Data', date: 'Current', url: 'https://data.brla.gov' },
  },

  metro: {
    medianPrice: 277143, medianPriceChange: 6.6,
    avgPrice: 328477, avgPriceChange: 5.2,
    closedSales: 636, closedSalesChange: 6.2,
    pendingSales: 913, pendingSalesChange: 0.8,
    newListings: 1242, newListingsChange: 6.2,
    inventory: 3170, inventoryChange: 10.6,
    dom: 45, domChange: 2.3,
    listSaleRatio: 99.7, listSaleRatioChange: 0.4,
    pricePerSqft: 160, pricePerSqftChange: 4.6,
    monthsSupply: 5.1,
    soldAboveList: 11.3,
    priceReductions: 28.0,
    investorActivity: 31,
    cashPurchases: 28,
  },

  statewide: {
    medianPrice: 241500, medianPriceChange: 1.8,
    newListings: 4598, newListingsChange: -6.1,
    pendingSales: 3339, pendingSalesChange: 7.7,
    dom: 85, domChange: 11.8,
    foreclosures: 371, reo: 84,
    totalHomesForSale: 15624, homesForSaleChange: 0.4,
    medianDom: 70, soldAboveList: 11.7, saleToList: 96.7,
  },

  national: {
    existingHomeSales: 4020000, existingHomeSalesChange: 1.7,
    medianExistingHomePrice: 396800,
    monthsSupply: 3.5, firstTimeBuyers: 31,
    cashSales: 28, distressedSales: 3, thirtyYearRate: 6.88,
  },

  markets: [
    { id: 'zachary', name: 'Zachary', parish: 'East Baton Rouge', heatScore: 87, label: 'Very Hot', medianPrice: 291000, medianPriceChange: 8.2, dom: 31, domChange: -12, pricePerSqft: 162, pricePerSqftChange: 5.9, listSaleRatio: 101, inventory: 2.8, closedSales: 89, pendingChange: 15.2, schoolRating: 95, floodRisk: 'Low', zone: 'X', recommendation: 'Price aggressively. Multiple offers common $250K–$330K.', source: 'gbrar', color: '#E24B4A' },
    { id: 'st-francisville', name: 'St. Francisville', parish: 'West Feliciana', heatScore: 74, label: 'Hot', medianPrice: 315000, medianPriceChange: 5.8, dom: 58, domChange: 2, pricePerSqft: 147, pricePerSqftChange: 7.3, listSaleRatio: 96, inventory: 45, closedSales: 22, pendingChange: 8.4, schoolRating: 78, floodRisk: 'Low', zone: 'X', recommendation: 'Lifestyle premium is real. Acreage 2+ acres commands 14–18% premium.', source: 'gbrar', color: '#EF9F27' },
    { id: 'central-ebr', name: 'Central / EBR', parish: 'East Baton Rouge', heatScore: 68, label: 'Balanced', medianPrice: 266000, medianPriceChange: -3.3, dom: 89, domChange: 17.1, pricePerSqft: 155, pricePerSqftChange: 1.3, listSaleRatio: 97, inventory: 5.8, closedSales: 312, pendingChange: 19.4, schoolRating: 72, floodRisk: 'Moderate', zone: 'AE/X', recommendation: 'Pending sales up 19.4% YoY — demand accelerating.', source: 'gbrar', color: '#1D9E75' },
    { id: 'prairieville', name: 'Prairieville', parish: 'Ascension', heatScore: 71, label: 'Hot', medianPrice: 285000, medianPriceChange: 4.1, dom: 42, domChange: -5, pricePerSqft: 155, pricePerSqftChange: 3.8, listSaleRatio: 98, inventory: 3.4, closedSales: 78, pendingChange: 11.2, schoolRating: 82, floodRisk: 'Low-Moderate', zone: 'X/AE', recommendation: 'Family demand steady. New construction adding moderate supply pressure.', source: 'gbrar', color: '#EF9F27' },
    { id: 'university-lakes', name: 'University Lakes', parish: 'East Baton Rouge', heatScore: 76, label: 'Hot', medianPrice: 398000, medianPriceChange: 6.4, dom: 29, domChange: -8, pricePerSqft: 198, pricePerSqftChange: 6.1, listSaleRatio: 100, inventory: 2.1, closedSales: 41, pendingChange: 14.8, schoolRating: 88, floodRisk: 'Low', zone: 'X', recommendation: 'Premium submarket. LSU adjacency premium. Lowest inventory in metro.', source: 'gbrar', color: '#EF9F27' },
    { id: 'denham-springs', name: 'Denham Springs', parish: 'Livingston', heatScore: 65, label: 'Balanced', medianPrice: 248000, medianPriceChange: 2.8, dom: 52, domChange: 4, pricePerSqft: 132, pricePerSqftChange: 2.1, listSaleRatio: 97, inventory: 4.9, closedSales: 95, pendingChange: 6.1, schoolRating: 75, floodRisk: 'Moderate', zone: 'AE/X', recommendation: 'Stable balanced market. Good investor entry point.', source: 'gbrar', color: '#1D9E75' },
    { id: 'mid-city', name: 'Mid City BR', parish: 'East Baton Rouge', heatScore: 62, label: 'Balanced', medianPrice: 241000, medianPriceChange: 1.2, dom: 67, domChange: 8, pricePerSqft: 128, pricePerSqftChange: 0.8, listSaleRatio: 97, inventory: 5.2, closedSales: 58, pendingChange: 4.2, schoolRating: 65, floodRisk: 'Moderate-High', zone: 'AE', recommendation: 'High walkability. Investor rehab upside.', source: 'gbrar', color: '#1D9E75' },
    { id: 'shenandoah', name: 'Shenandoah', parish: 'East Baton Rouge', heatScore: 58, label: 'Cool', medianPrice: 312000, medianPriceChange: -1.1, dom: 78, domChange: 12, pricePerSqft: 171, pricePerSqftChange: -0.5, listSaleRatio: 96, inventory: 6.8, closedSales: 34, pendingChange: -2.1, schoolRating: 70, floodRisk: 'Low', zone: 'X', recommendation: 'Established luxury corridor. Buyer has negotiating leverage.', source: 'gbrar', color: '#185FA5' },
  ],

  rentals: {
    studio: 785, oneBed: 912, twoBed: 1089, threeBed: 1398, fourBed: 1621,
    source: 'hud', year: 2025, metro: 'Baton Rouge MSA'
  },

  commercial: {
    totalForSale: 2771, totalForLease: 3587, source: 'crexi',
    multifamily: [
      { name: 'Bluebonnet Blvd Portfolio', type: 'Multifamily', units: 48, askingPrice: 4200000, capRate: 6.2, pricePerUnit: 87500, city: 'Baton Rouge' },
      { name: 'Zachary Commons Apartments', type: 'Multifamily', units: 24, askingPrice: 2100000, capRate: 7.1, pricePerUnit: 87500, city: 'Zachary' },
      { name: 'Perkins Row Mixed-Use', type: 'Mixed-Use', units: 12, askingPrice: 1800000, capRate: 5.8, pricePerUnit: 150000, city: 'Baton Rouge' },
      { name: 'Denham Springs Duplex Portfolio', type: 'Multifamily', units: 16, askingPrice: 1250000, capRate: 8.4, pricePerUnit: 78125, city: 'Denham Springs' },
    ],
    marketMetrics: { avgCapRate: 6.8, avgPricePerUnit: 89400, vacancyRate: 6.2, avgRentGrowth: 4.1, constructionPipeline: 340, source: 'crexi' }
  },

  propstream: {
    preDistressLeads: 847, absenteeOwners: 2341, highEquity: 1892,
    taxDelinquent: 412, vacantProperties: 634, estimatedValue: '240M+',
    lastPull: 'March 2026'
  },

  foreclosures: {
    total: 371, new: 349, reo: 84, state: 'Louisiana',
    brParish: { total: 48, new: 41, reo: 12 }
  }
} as const
