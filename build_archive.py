import io, json, math, time
from pathlib import Path
import numpy as np
import pandas as pd
import requests
import yfinance as yf

OUT=Path("data")
OUT.mkdir(exist_ok=True)

# Fallback list of prominent liquid stocks in case official constituent download fails.
FALLBACK = [
"ABB","ABCAPITAL","ABFRL","ACC","ADANIENT","ADANIGREEN","ADANIPORTS","ADANIPOWER","ALKEM","AMBUJACEM","APLAPOLLO",
"APOLLOHOSP","ASHOKLEY","ASIANPAINT","ASTRAL","AUBANK","AUROPHARMA","AXISBANK","BAJAJ-AUTO","BAJAJFINSV","BAJFINANCE",
"BALKRISIND","BANDHANBNK","BANKBARODA","BEL","BHARATFORG","BHARTIARTL","BHEL","BIOCON","BPCL","BRITANNIA","CANBK","CGPOWER",
"CHOLAFIN","CIPLA","COALINDIA","COFORGE","COLPAL","CONCOR","CROMPTON","CUMMINSIND","DABUR","DELHIVERY","DIVISLAB","DIXON",
"DLF","DMART","DRREDDY","EICHERMOT","ESCORTS","ETERNAL","FEDERALBNK","GAIL","GLENMARK","GODREJCP","GODREJPROP","GRASIM",
"HAL","HAVELLS","HCLTECH","HDFCBANK","HDFCLIFE","HEROMOTOCO","HINDALCO","HINDPETRO","HINDUNILVR","ICICIBANK","ICICIGI",
"ICICIPRULI","IDFCFIRSTB","IEX","INDHOTEL","INDIGO","INDUSINDBK","INDUSTOWER","INFY","IOC","IRCTC","ITC","JINDALSTEL",
"JIOFIN","JSWENERGY","JSWSTEEL","JUBLFOOD","KALYANKJIL","KEI","KOTAKBANK","KPITTECH","LAURUSLABS","LICI","LODHA","LT","LTIM",
"LUPIN","M&M","MARICO","MARUTI","MAXHEALTH","MAZDOCK","MCX","MFSL","MOTHERSON","MRF","MUTHOOTFIN","NAUKRI","NESTLEIND","NHPC",
"NMDC","NTPC","OBEROIRLTY","OIL","ONGC","PERSISTENT","PETRONET","PFC","PHOENIXLTD","PIDILITIND","PIIND","PNB","POLYCAB",
"POWERGRID","PRESTIGE","RECLTD","RELIANCE","RVNL","SAIL","SBICARD","SBILIFE","SBIN","SHREECEM","SHRIRAMFIN","SIEMENS",
"SOLARINDS","SRF","SUNPHARMA","SUPREMEIND","SUZLON","TATACONSUM","TATAELXSI","TATAMOTORS","TATAPOWER","TATASTEEL","TCS",
"TECHM","TITAN","TORNTPHARM","TORNTPOWER","TRENT","TVSMOTOR","UBL","ULTRACEMCO","UNIONBANK","UPL","VBL","VEDL","VOLTAS","WIPRO","YESBANK","ZYDUSLIFE"
]

CONSTITUENT_URL = "https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv"

def universe():
    try:
        r = requests.get(CONSTITUENT_URL, timeout=30, headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        df = pd.read_csv(io.StringIO(r.text))
        symbol_col = next(c for c in df.columns if c.strip().lower()=="symbol")
        name_col = next((c for c in df.columns if "company" in c.lower()), None)
        rows=[]
        for _, row in df.iterrows():
            symbol = str(row[symbol_col]).strip()
            if symbol and symbol != "nan":
                name = str(row[name_col]).strip() if name_col else symbol
                rows.append((symbol, name))
        if len(rows) >= 150:
            return rows
    except Exception as e:
        print("Official Nifty 200 download failed, using fallback universe:", e)
    return [(s,s) for s in FALLBACK]

def get_history(symbol):
    ticker = symbol + ".NS"
    df = yf.download(ticker, period="1y", interval="1d", auto_adjust=True, progress=False, threads=False)
    if df.empty or len(df) < 100:
        return None
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]
    close = pd.to_numeric(df["Close"], errors="coerce").dropna()
    if len(close) < 100:
        return None
    logret = np.log(close / close.shift(1)).dropna()
    vol = float(logret.std(ddof=1) * math.sqrt(252) * 100)

    rows=[]
    for idx, row in df.iterrows():
        c = row.get("Close")
        if pd.isna(c):
            continue
        rows.append({
            "date": idx.strftime("%Y-%m-%d"),
            "open": None if pd.isna(row.get("Open")) else round(float(row.get("Open")),4),
            "high": None if pd.isna(row.get("High")) else round(float(row.get("High")),4),
            "low": None if pd.isna(row.get("Low")) else round(float(row.get("Low")),4),
            "close": round(float(c),4),
            "volume": None if pd.isna(row.get("Volume")) else int(row.get("Volume"))
        })
    return vol, rows

candidates=[]
for symbol, name in universe():
    try:
        result = get_history(symbol)
        if result:
            vol, rows = result
            candidates.append({"symbol":symbol, "name":name, "volatility_pct":vol, "rows":rows})
            print(symbol, round(vol,2), len(rows))
    except Exception as e:
        print("FAILED", symbol, e)
    time.sleep(0.05)

if len(candidates) < 100:
    raise SystemExit(f"Only {len(candidates)} valid histories downloaded; need at least 100.")

candidates.sort(key=lambda x:x["volatility_pct"], reverse=True)
chosen = candidates[:100]

for p in OUT.glob("*.json"):
    p.unlink()

meta=[]
for rank, item in enumerate(chosen, start=1):
    (OUT / f"{item['symbol']}.json").write_text(json.dumps(item["rows"], separators=(",",":")), encoding="utf-8")
    meta.append({
        "rank": rank,
        "symbol": item["symbol"],
        "name": item["name"],
        "volatility_pct": round(item["volatility_pct"],4),
        "trading_days": len(item["rows"])
    })

(OUT / "stocks.json").write_text(json.dumps(meta, separators=(",",":")), encoding="utf-8")
print("Done. Wrote", len(meta), "ranked stock histories.")
