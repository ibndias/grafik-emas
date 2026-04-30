#!/usr/bin/env python3
"""Build-time fetch for gold prices and USD->IDR rates.
Always exits 0 so deploys never break; client falls back to bundled CSV/static."""

import csv
import datetime
import json
import os
import sys
import urllib.error
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OUT_DIR = "api"
os.makedirs(OUT_DIR, exist_ok=True)


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json,text/csv,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def yahoo_daily(symbol, start_year):
    p1 = int(datetime.datetime(start_year, 1, 1).timestamp())
    p2 = int(datetime.datetime.now().timestamp())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
           f"?period1={p1}&period2={p2}&interval=1d")
    data = json.loads(fetch(url))
    r = data["chart"]["result"][0]
    ts = r["timestamp"]
    closes = r["indicators"]["quote"][0]["close"]
    rows = []
    for t, c in zip(ts, closes):
        if c is None:
            continue
        rows.append((datetime.datetime.utcfromtimestamp(t).date().isoformat(),
                     float(c)))
    return rows


def datahub_gold_monthly():
    raw = fetch("https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv")
    rows = []
    for line in raw.strip().split("\n")[1:]:
        if "," not in line:
            continue
        date, price = line.split(",", 1)
        if len(date) == 7 and date[4] == "-":
            try:
                rows.append((date + "-15", float(price)))
            except ValueError:
                pass
    return rows


def frankfurter_idr():
    raw = fetch("https://api.frankfurter.app/1999-01-04..?from=USD&to=IDR")
    data = json.loads(raw)
    return [(d, float(data["rates"][d]["IDR"])) for d in sorted(data["rates"])]


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["DATE", "VALUE"])
        for d, v in rows:
            w.writerow([d, f"{v:.4f}".rstrip("0").rstrip(".")])


def read_existing(path):
    """Return (row_count, last_date) for an existing CSV, or (0, '')."""
    if not os.path.exists(path):
        return 0, ""
    try:
        with open(path) as f:
            lines = [ln for ln in f.read().strip().split("\n")[1:] if ln]
        if not lines:
            return 0, ""
        last_date = lines[-1].split(",")[0]
        return len(lines), last_date
    except OSError:
        return 0, ""


def write_if_better(path, new_rows, label):
    """Only overwrite if new data is at least as fresh and as complete as existing.
    Prevents a transient upstream failure from downgrading committed daily data
    to coarser monthly data."""
    existing_count, existing_last = read_existing(path)
    new_count = len(new_rows)
    new_last = new_rows[-1][0] if new_rows else ""

    if existing_count and (new_last < existing_last or new_count < existing_count):
        print(f"  -> {os.path.basename(path)}: KEPT existing "
              f"({existing_count} rows, last {existing_last}) — "
              f"new fetch only had {new_count} rows / last {new_last}")
        return False, existing_count, existing_last

    write_csv(path, new_rows)
    print(f"  -> {os.path.basename(path)}: written ({new_count} rows, last {new_last})")
    return True, new_count, new_last


def attempt(label, fn):
    try:
        out = fn()
        if out:
            print(f"  OK: {label} ({len(out)} rows)")
            return out
        print(f"  empty: {label}")
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError,
            KeyError, OSError, ValueError, TimeoutError) as e:
        print(f"  fail: {label} — {type(e).__name__}: {e}")
    return None


# ---------- GOLD ----------
print("Fetching gold prices...")
gold_sources = []

yahoo_gold = attempt("Yahoo GC=F daily",
                     lambda: yahoo_daily("GC=F", 1995))
dh_gold = attempt("datahub.io monthly",
                  datahub_gold_monthly)

merged_gold = []
if yahoo_gold and dh_gold:
    cutoff = yahoo_gold[0][0]
    older = [r for r in dh_gold if r[0] < cutoff]
    merged_gold = older + yahoo_gold
    gold_sources = [f"Yahoo GC=F daily ({len(yahoo_gold)})",
                    f"datahub.io monthly pre-{cutoff[:4]} ({len(older)})"]
elif yahoo_gold:
    merged_gold = yahoo_gold
    gold_sources = [f"Yahoo GC=F daily ({len(yahoo_gold)})"]
elif dh_gold:
    merged_gold = dh_gold
    gold_sources = [f"datahub.io monthly ({len(dh_gold)})"]

if merged_gold:
    write_if_better(os.path.join(OUT_DIR, "gold.csv"), merged_gold, "gold")
else:
    existing_count, existing_last = read_existing(os.path.join(OUT_DIR, "gold.csv"))
    if existing_count:
        print(f"  -> gold.csv: KEPT existing ({existing_count} rows, last {existing_last}) "
              f"— all fetches failed")
        gold_sources = [f"existing committed CSV ({existing_count} rows)"]
    else:
        print("  -> gold.csv NOT written (no existing, all sources failed)")
        gold_sources = ["FAILED"]


# ---------- IDR ----------
print("Fetching USD->IDR rates...")
idr_sources = []

idr_rows = attempt("frankfurter.app (ECB)", frankfurter_idr)
if not idr_rows:
    idr_rows = attempt("Yahoo IDR=X daily",
                       lambda: yahoo_daily("IDR=X", 2003))
    if idr_rows:
        idr_sources = [f"Yahoo IDR=X daily ({len(idr_rows)})"]
elif idr_rows:
    idr_sources = [f"frankfurter.app ({len(idr_rows)})"]

if idr_rows:
    write_if_better(os.path.join(OUT_DIR, "idr.csv"), idr_rows, "idr")
else:
    existing_count, existing_last = read_existing(os.path.join(OUT_DIR, "idr.csv"))
    if existing_count:
        print(f"  -> idr.csv: KEPT existing ({existing_count} rows, last {existing_last})")
        idr_sources = [f"existing committed CSV ({existing_count} rows)"]
    else:
        print("  -> idr.csv NOT written (all sources failed)")
        idr_sources = ["FAILED"]


# ---------- Build info ----------
gold_count, gold_last_date = read_existing(os.path.join(OUT_DIR, "gold.csv"))
idr_count, idr_last_date = read_existing(os.path.join(OUT_DIR, "idr.csv"))

build_info = {
    "built_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    "gold_sources": gold_sources,
    "idr_sources": idr_sources,
    "gold_last_date": gold_last_date,
    "gold_rows": gold_count,
    "idr_last_date": idr_last_date,
    "idr_rows": idr_count,
}
with open(os.path.join(OUT_DIR, "build-info.json"), "w") as f:
    json.dump(build_info, f, indent=2)

print("Build info:", json.dumps(build_info, indent=2))
sys.exit(0)
