import io, json, math, time
from pathlib import Path
import numpy as np
import pandas as pd
import requests
import yfinance as yf

OUT=Path("data")
OUT.mkdir(exist_ok=True)
FALLBACK=['ABB', 'ABCAPITAL', 'ABFRL', 'ACC', 'ADANIENSOL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS', 'ADANIPOWER', 'ALKEM', 'AMBUJACEM', 'ANGELONE', 'APLAPOLLO', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT', 'ASTRAL', 'ATGL', 'AUBANK', 'AUROPHARMA', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV', 'BAJFINANCE', 'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BANKINDIA', 'BDL', 'BEL', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'BSE', 'CANBK', 'CGPOWER', 'CHOLAFIN', 'CIPLA', 'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'CROMPTON', 'CUMMINSIND', 'DABUR', 'DALBHARAT', 'DELHIVERY', 'DIVISLAB', 'DIXON', 'DLF', 'DMART', 'DRREDDY', 'EICHERMOT', 'ETERNAL', 'EXIDEIND', 'FEDERALBNK', 'FORTIS', 'GAIL', 'GLENMARK', 'GMRINFRA', 'GODREJCP', 'GODREJPROP', 'GRASIM', 'HAL', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HFCL', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO', 'HINDUNILVR', 'HUDCO', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDEA', 'IDFCFIRSTB', 'IEX', 'IGL', 'INDHOTEL', 'INDIGO', 'INDUSINDBK', 'INDUSTOWER', 'INFY', 'IOC', 'IREDA', 'IRFC', 'IRCTC', 'ITC', 'JINDALSTEL', 'JIOFIN', 'JSWENERGY', 'JSWSTEEL', 'JUBLFOOD', 'KALYANKJIL', 'KEI', 'KOTAKBANK', 'KPITTECH', 'LALPATHLAB', 'LAURUSLABS', 'LICHSGFIN', 'LICI', 'LODHA', 'LT', 'LTIM', 'LUPIN', 'M&M', 'MANKIND', 'MARICO', 'MARUTI', 'MAXHEALTH', 'MAZDOCK', 'MCX', 'MFSL', 'MOTHERSON', 'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NAUKRI', 'NATIONALUM', 'NESTLEIND', 'NHPC', 'NMDC', 'NTPC', 'NYKAA', 'OBEROIRLTY', 'OFSS', 'OIL', 'ONGC', 'PAGEIND', 'PAYTM', 'PEL', 'PERSISTENT', 'PETRONET', 'PFC', 'PHOENIXLTD', 'PIDILITIND', 'PIIND', 'PNB', 'POLICYBZR', 'POLYCAB', 'POWERGRID', 'PRESTIGE', 'RECLTD', 'RELIANCE', 'RVNL', 'SAIL', 'SBICARD', 'SBILIFE', 'SBIN', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SOLARINDS', 'SONACOMS', 'SRF', 'SUNPHARMA', 'SUPREMEIND', 'SUZLON', 'TATACHEM', 'TATACOMM', 'TATACONSUM', 'TATAELXSI', 'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TCS', 'TECHM', 'TIINDIA', 'TITAN', 'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'UBL', 'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'UPL', 'VBL', 'VEDL', 'VOLTAS', 'WIPRO', 'YESBANK', 'ZYDUSLIFE', 'AIAENG', 'AJANTPHARM', 'BATAINDIA', 'BHARATRAS', 'BLUESTARCO', 'CARBORUNIV', 'CDSL', 'CENTRALBK', 'COCHINSHIP', 'DEEPAKNTR', 'EIHOTEL', 'ESCORTS', 'FACT', 'FLUOROCHEM', 'GLAND', 'GUJGASLTD', 'IDBI', 'IPCALAB', 'JKCEMENT', 'KAYNES', 'KFINTECH', 'MANAPPURAM', 'NLCINDIA', 'PATANJALI', 'RBLBANK', 'SJVN']
CONSTITUENT_URL="https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv"

def universe():
    try:
        r=requests.get(CONSTITUENT_URL,timeout=30,headers={"User-Agent":"Mozilla/5.0"})
        r.raise_for_status()
        df=pd.read_csv(io.StringIO(r.text))
        sym_col=next(c for c in df.columns if c.strip().lower()=="symbol")
        name_col=next((c for c in df.columns if "company" in c.lower()), None)
        rows=[]
        for _,row in df.iterrows():
            s=str(row[sym_col]).strip()
            if s and s!="nan":
                rows.append((s, str(row[name_col]).strip() if name_col else s))
        if len(rows)>=150:
            print("Using official Nifty 200 constituents:",len(rows))
            return rows
    except Exception as e:
        print("Official constituent download failed; using bundled fallback universe:",e)
    return [(s,s) for s in FALLBACK]

def one_year(symbol):
    ticker=symbol+".NS"
    df=yf.download(ticker,period="1y",interval="1d",auto_adjust=True,progress=False,threads=False)
    if df.empty or len(df)<100:
        return None
    if isinstance(df.columns,pd.MultiIndex):
        df.columns=[c[0] for c in df.columns]
    close=pd.to_numeric(df["Close"],errors="coerce").dropna()
    if len(close)<100:return None
    logret=np.log(close/close.shift(1)).dropna()
    vol=float(logret.std(ddof=1)*math.sqrt(252)*100)
    rows=[]
    for idx,row in df.iterrows():
        c=row.get("Close")
        if pd.isna(c):continue
        rows.append({
            "date":idx.strftime("%Y-%m-%d"),
            "open":None if pd.isna(row.get("Open")) else round(float(row.get("Open")),4),
            "high":None if pd.isna(row.get("High")) else round(float(row.get("High")),4),
            "low":None if pd.isna(row.get("Low")) else round(float(row.get("Low")),4),
            "close":round(float(c),4),
            "volume":None if pd.isna(row.get("Volume")) else int(row.get("Volume"))
        })
    return vol,rows

candidates=[]
for symbol,name in universe():
    try:
        out=one_year(symbol)
        if out:
            vol,rows=out
            candidates.append({"symbol":symbol,"name":name,"volatility_pct":vol,"rows":rows})
            print(symbol,round(vol,2),len(rows))
    except Exception as e:
        print("FAILED",symbol,e)
    time.sleep(0.05)

if len(candidates)<100:
    raise SystemExit(f"Only {len(candidates)} valid histories downloaded; need at least 100.")

candidates.sort(key=lambda x:x["volatility_pct"],reverse=True)
chosen=candidates[:100]

# Remove old generated JSON, then write exactly the top 100.
for p in OUT.glob("*.json"):p.unlink()

meta=[]
for rank,item in enumerate(chosen,1):
    (OUT/f"{item['symbol']}.json").write_text(json.dumps(item["rows"],separators=(",",":")),encoding="utf-8")
    meta.append({
        "rank":rank,
        "symbol":item["symbol"],
        "name":item["name"],
        "volatility_pct":round(item["volatility_pct"],4),
        "trading_days":len(item["rows"])
    })

(OUT/"stocks.json").write_text(json.dumps(meta,separators=(",",":")),encoding="utf-8")
print("Wrote exactly",len(meta),"stock histories + stocks.json")
