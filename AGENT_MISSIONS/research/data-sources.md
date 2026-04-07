# Data Sources — Complete Catalog for AIRE Intelligence
*Agent 4 Research — 2026-04-04*

## Public Real Estate Data APIs

### 1. FEMA National Flood Hazard Layer (PRIORITY 1 — Free)
**URL:** https://hazards.fema.gov/gis/nfhl/rest/services
**Cost:** Free, no API key needed
**Data:** Flood zone, SFHA status, base flood elevation, floodway designation
**Update:** Monthly map updates
**Rate Limits:** Reasonable for our volume

**Integration Spec:**
```
GET https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query
Parameters:
  where=1%3D1
  geometry={"x":-91.1872,"y":30.4515,"spatialReference":{"wkid":4326}}
  geometryType=esriGeometryPoint
  spatialRel=esriSpatialRelIntersects
  outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE
  f=json
  returnGeometry=false

Response:
{
  "features": [{
    "attributes": {
      "FLD_ZONE": "X",        // Zone code
      "ZONE_SUBTY": "0500",   // Subtype (500-year floodplain)
      "SFHA_TF": "F",         // Special Flood Hazard Area (T/F)
      "STATIC_BFE": -9999     // Base flood elevation (-9999 = none)
    }
  }]
}
```

**Transform for DB:**
```sql
INSERT INTO properties_clean (address, flood_zone, sfha, bfe, flood_checked_at)
VALUES ($1, $2, $3, $4, NOW());
```

**Benefits:** Compliance scanner (La. R.S. 38:84), property scoring (15% weight in AIRE Score), morning brief alerts.

---

### 2. US Census Bureau ACS (PRIORITY 2 — Free)
**URL:** https://api.census.gov/data.html
**Cost:** Free (API key required, instant approval)
**Data:** Population, median income, housing units, vacancy rates, demographics by census tract/county
**Update:** ACS 5-year estimates updated annually, 1-year estimates monthly

**Integration Spec:**
```
GET https://api.census.gov/data/2024/acs/acs5
?get=B19013_001E,B25077_001E,B25001_001E,B25002_003E
&for=county:033,005,063
&in=state:22
&key=YOUR_API_KEY

Fields:
  B19013_001E = Median household income
  B25077_001E = Median home value
  B25001_001E = Total housing units
  B25002_003E = Vacant housing units

State 22 = Louisiana
County 033 = East Baton Rouge
County 005 = Ascension
County 063 = Livingston
```

**Transform for DB:**
```sql
INSERT INTO market_snapshots (parish, median_income, median_home_value, housing_units, vacancy_rate, period)
VALUES ($1, $2, $3, $4, $5::float / $4::float, $6);
```

**Benefits:** Market snapshots, neighborhood scoring, morning brief context, AIRE Score (neighborhood trend weight).

---

### 3. Freddie Mac PMMS — Mortgage Rates (PRIORITY 2 — Free)
**URL:** https://www.freddiemac.com/pmms
**Data feed:** https://www.freddiemac.com/pmms/docs/historicalweeklydata.xlsx (downloadable)
**Cost:** Free, no API key
**Data:** Weekly average 30-year fixed, 15-year fixed, 5/1 ARM rates
**Update:** Weekly (Thursday)

**Integration:** Download weekly Excel, parse last row for current rates.

**Benefits:** Morning brief market section, deal affordability calculations, buyer payment estimates.

---

### 4. FRED API — Federal Reserve Economic Data (PRIORITY 3 — Free)
**URL:** https://fred.stlouisfed.org/docs/api/fred/
**Cost:** Free (API key required, instant approval)
**Data:** Mortgage rates (MORTGAGE30US), housing starts (HOUST), Case-Shiller index (CSUSHPISA), unemployment
**Update:** Varies (weekly to monthly depending on series)

**Integration Spec:**
```
GET https://api.stlouisfed.org/fred/series/observations
?series_id=MORTGAGE30US
&api_key=YOUR_KEY
&file_type=json
&sort_order=desc
&limit=4

Response:
{
  "observations": [{
    "date": "2026-03-28",
    "value": "6.42"
  }]
}
```

**Benefits:** Morning brief economic context, market trend analysis, investor metrics.

---

### 5. HUD Fair Market Rents (PRIORITY 3 — Free)
**URL:** https://www.huduser.gov/portal/dataset/fmr-api.html
**Cost:** Free
**Data:** Fair market rents by ZIP code, by bedroom count (0BR to 4BR)
**Update:** Annual (October each year)

**Integration Spec:**
```
GET https://www.huduser.gov/hudapi/public/fmr/data/70810
(ZIP code for Baton Rouge)

Response includes:
{
  "data": {
    "basicdata": {
      "zip_code": "70810",
      "Efficiency": 735,
      "One-Bedroom": 812,
      "Two-Bedroom": 978,
      "Three-Bedroom": 1289,
      "Four-Bedroom": 1541
    }
  }
}
```

**Benefits:** Investor deal analysis (cash flow projection), 1% rule calculation, cap rate estimation.

---

## Louisiana-Specific Data Sources

### East Baton Rouge Parish Assessor (PRIORITY 1)
**URL:** https://www.ebrpa.org/
**GIS:** https://maps.brla.gov/
**Access:** Web search by address/owner/parcel. No REST API. Would need scraping or use their ArcGIS services at maps.brla.gov.
**Data:** Tax assessed value, legal description (lot/block/subdivision), owner name, homestead status, land area, improvement value, millage rates.
**Update:** Annual assessments, daily ownership transfers.

**Potential ArcGIS endpoint:**
```
https://gis.brla.gov/arcgis/rest/services/
(Need to discover available layers/services)
```

**Benefits:** Contract writing (legal descriptions), property scoring, compliance (homestead exemption verification).

---

### Ascension Parish Assessor (PRIORITY 2)
**URL:** https://www.ascensionassessor.com/
**Access:** Same pattern as EBR — web search, no API.
**Data:** Same fields as EBR.

### Livingston Parish Assessor (PRIORITY 3)
**URL:** https://www.livingstonassessor.com/
**Access:** Web search, no API.
**Data:** Same fields as EBR.

### LREC — Louisiana Real Estate Commission (PRIORITY 2)
**URL:** https://www.lrec.louisiana.gov/
**Access:** Manual download of forms, web search for license verification.
**Data:** Form PDFs (updated ~annually), license status, disciplinary actions, rule changes.
**Action:** Check quarterly for form version updates. Compare downloaded forms against `form-tracker.ts` known signatures.

### Louisiana Secretary of State (PRIORITY 4)
**URL:** https://www.sos.la.gov/BusinessServices/
**Access:** Web search for entity/LLC lookup.
**Data:** Entity status, registered agent, filing history.
**Use case:** Verify LLC buyers/sellers in commercial transactions.

---

## Paid APIs (Future Consideration)

### ATTOM Data Solutions
**URL:** https://api.gateway.attomdata.com/
**Cost:** Free tier 100 calls/month. Paid starts ~$200/mo.
**Data:** AVM, property details, sales history, tax assessment, school ratings, flood, demographics.
**Value:** Most comprehensive property data API. Would power AIRE Estimate AVM directly.

### Walk Score API
**URL:** https://www.walkscore.com/professional/api.php
**Cost:** Free for < 5000 requests/day.
**Data:** Walk Score, Transit Score, Bike Score by address.
**Value:** Neighborhood livability scoring for AIRE Score.

### Google Maps / Places API
**URL:** https://developers.google.com/maps
**Cost:** $200/month free credit, then per-request pricing.
**Data:** Geocoding, places nearby (schools, shopping, parks), commute times.
**Value:** Enrichment for property scoring and neighborhood analysis.

---

## Data Integration Priority

| Rank | Source | Cost | Effort | What It Unlocks |
|------|--------|------|--------|----------------|
| 1 | FEMA Flood API | Free | 2 | Compliance, scoring, disclosure verification |
| 2 | Census ACS | Free | 3 | Market snapshots, neighborhood scoring |
| 3 | Freddie Mac PMMS | Free | 1 | Morning brief rates, affordability calc |
| 4 | FRED API | Free | 2 | Economic context, trend analysis |
| 5 | HUD FMR | Free | 2 | Investor cash flow analysis |
| 6 | EBR Parish Assessor | Free | 4 | Legal descriptions, tax data |
| 7 | ATTOM Data | $200/mo | 3 | Full AVM, comprehensive property data |
| 8 | Walk Score | Free* | 2 | Livability scoring |

**Recommended integration order:** FEMA → Census → Freddie Mac → FRED → HUD (all free, high impact).
