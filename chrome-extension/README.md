# AIRE MLS Auto-Fill — Chrome Extension

Auto-fill Paragon MLS listing forms with transaction data from AIRE Intelligence.

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this `chrome-extension` folder
5. The AIRE extension icon appears in your toolbar

## Setup

1. Click the AIRE extension icon in the Chrome toolbar
2. Enter your **AIRE Server URL** (defaults to `https://aireintel.org`)
3. Enter your **API Token** and click **Save**
4. Your transactions will load automatically

## Usage

1. Navigate to a Paragon MLS listing input page (`paragon.fnismls.com` or `matrix.fnismls.com`)
2. Click the AIRE extension icon
3. Select the transaction you want to fill from
4. Click **Fill MLS Form**
5. Watch the status bar at the bottom of the page as fields are filled

## What Gets Filled

The extension maps AIRE transaction data to standard MLS fields:

| Category | Fields |
|----------|--------|
| Address | Street number, direction, name, suffix, city, state, zip |
| Pricing | List price, sale price, original price |
| Property | Type, bedrooms, bathrooms, sqft, lot size, year built |
| Dates | Listing date, closing date, expiration date |
| Agent | Name, phone, email, office |
| Description | Public remarks, private remarks, directions |
| Louisiana | Parish, subdivision, legal description |

## Field Matching

The extension uses multiple strategies to find form fields:

1. Direct name/ID match (e.g., `name="ListPrice"`)
2. Paragon field number pattern (e.g., `field_68`)
3. Partial name matching (case-insensitive)
4. Label text proximity matching
5. Table cell label scanning (common in Paragon layouts)

## Visual Indicators

- **Green outline** — Field was successfully filled
- **Red outline** — Required field that is still empty after fill
- **Status bar** — Shows real-time progress at the bottom of the page

## Supported MLS Platforms

- Paragon MLS (`paragon.fnismls.com`)
- Matrix MLS (`matrix.fnismls.com`)

## Troubleshooting

- **"Could not connect to MLS page"** — Refresh the MLS page and try again. The content script needs to be injected first.
- **Fields not filling** — Paragon may use non-standard field names. Check the browser console for debug info.
- **Token expired** — Re-enter your API token in the extension popup and click Save.

## Development

This is a plain HTML/JS/CSS Chrome extension with no build step required. Edit the files directly and reload the extension at `chrome://extensions`.

### Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration (permissions, content scripts) |
| `popup.html` | Extension popup UI |
| `popup.js` | Popup logic (API calls, transaction selection) |
| `content.js` | Content script (field finding, form filling) |
| `content.css` | Injected styles for field highlights |
| `background.js` | Service worker (install handler, MLS badge) |
| `icons/` | Extension icons (16, 48, 128px) |
