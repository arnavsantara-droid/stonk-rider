# Stock Rider India

Static GitHub Pages game. Upload all files in this folder to the root of a GitHub repository.

## GitHub Pages setup
1. Repository → Settings → Pages.
2. Source: **Deploy from a branch**.
3. Branch: **main** / **(root)**.
4. Save.
5. Open the generated `https://YOUR-USERNAME.github.io/YOUR-REPO/` URL on your phone.
6. Add to Home Screen / Install.

## What it does
- Uses Indian NSE tickers (`.NS`).
- Loads historical daily prices from Yahoo Finance's public chart endpoint at runtime.
- Converts the daily price path into motorcycle terrain.
- Draws exactly **2 subtle white vertical time markers per returned trading session**.
  - 250 trading sessions → 500 vertical markers.
  - 365 sessions → 730 vertical markers.
- Touch controls are included for phone play.
- Installable PWA with offline caching for the app shell.

## Files
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `service-worker.js`
- `icon-192.png`
- `icon-512.png`

## Note
GitHub Pages is static. Historical market data is fetched directly in the browser, so the phone needs internet access when loading a new stock/period. If Yahoo blocks the browser request on a particular network, the app will show an error instead of inventing data.
