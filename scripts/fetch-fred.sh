#!/usr/bin/env bash
# Fetch FRED series at build time and bake into static CSV files.
# Build never fails: if FRED is unreachable, site falls back to static data.
set -u

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
OUT_DIR="api"
mkdir -p "$OUT_DIR"

fetch_series() {
  local series="$1"
  local out="$OUT_DIR/$2"
  local url="https://fred.stlouisfed.org/graph/fredgraph.csv?id=$series"

  echo "Fetching FRED series $series..."
  local code
  code=$(curl -sS -o "$out.tmp" -w "%{http_code}" \
    -A "$UA" \
    -H "Accept: text/csv,text/plain,*/*" \
    -H "Accept-Language: en-US,en;q=0.9" \
    --max-time 30 \
    --retry 3 --retry-delay 2 \
    "$url" || echo "000")

  if [ "$code" = "200" ] && head -1 "$out.tmp" | grep -qi "^DATE"; then
    mv "$out.tmp" "$out"
    echo "  OK: $series -> $out ($(wc -l < "$out") rows, last=$(tail -1 "$out"))"
  else
    echo "  WARNING: $series fetch failed (HTTP $code); removing partial file"
    rm -f "$out.tmp" "$out"
  fi
}

fetch_series "GOLDAMGBD228NLBM" "fred-gold.csv"
fetch_series "DEXINUS"          "fred-idr.csv"

exit 0
