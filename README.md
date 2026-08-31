# Stock Rider India — UI Refresh

This refresh redesigns the game to feel more like a sleek trading terminal.

## New UI changes
- More polished dark terminal layout
- Dedicated **Play** button
- Large **left ride button** = reverse + lean back
- Large **right ride button** = accelerate + tilt forward
- Right-side track-intel panel
- Chart-first layout with terminal-style top ticker strip

## Data
The app still reads:
- `data/stocks.json`
- `data/<SYMBOL>.json`

Those are created by the GitHub Action **Build 100-stock archive**.

## If data already exists
You do NOT need to rerun the workflow just for the UI refresh.
Only rerun it if you want to refresh the stock archive itself.
