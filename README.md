# Stock Rider India — 100-stock real-data build

## Selection rule
1. Start from the official Nifty 200 constituent universe when available.
2. Download one year of adjusted daily NSE prices.
3. Calculate annualized historical volatility:
   `std(log daily returns) × sqrt(252)`.
4. Rank descending.
5. Save exactly the top 100 valid stocks.

This keeps the universe prominent/liquid while deliberately favoring volatile charts.

## First-time GitHub setup
After uploading this package:

1. GitHub repository → **Actions**.
2. Open **Build 100-stock archive**.
3. Click **Run workflow** → **Run workflow**.
4. Wait for the green check.
5. The Action creates:
   - `data/stocks.json`
   - exactly 100 ticker JSON files containing actual 1-year daily OHLC/volume history.
6. Wait about 1–3 minutes for GitHub Pages to redeploy.
7. Refresh the game.

The Action also refreshes on weekdays.

## Grid
For every historical trading row the game draws 2 faint white vertical lines.
For N trading sessions: `2 × N` lines.

## Important
The historical data is generated server-side by GitHub Actions rather than fetched by the phone browser. This fixes the CORS/data problem in the first build.
