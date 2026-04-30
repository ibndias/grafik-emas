#!/usr/bin/env bash
# Fetch FRED LBMA Gold Price (AM Fix) at build time and bake into /api/fred-gold.csv.
# Build never fails: if FRED is unreachable, site falls back to static 1925-1967 data.
set -u

URL="https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM"
OUT_DIR="api"
OUT_FILE="$OUT_DIR/fred-gold.csv"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

mkdir -p "$OUT_DIR"

echo "Fetching FRED gold price series..."
HTTP_CODE=$(curl -sS -o "$OUT_FILE.tmp" -w "%{http_code}" \
  -A "$UA" \
  -H "Accept: text/csv,text/plain,*/*" \
  -H "Accept-Language: en-US,en;q=0.9" \
  --max-time 30 \
  --retry 3 --retry-delay 2 \
  "$URL" || echo "000")

if [ "$HTTP_CODE" = "200" ] && head -1 "$OUT_FILE.tmp" | grep -qi "^DATE"; then
  mv "$OUT_FILE.tmp" "$OUT_FILE"
  ROWS=$(wc -l < "$OUT_FILE")
  LAST=$(tail -1 "$OUT_FILE")
  echo "FRED fetch OK: $ROWS rows, last=$LAST"
else
  echo "WARNING: FRED fetch failed (HTTP $HTTP_CODE). Removing partial file; client will fallback to static data."
  rm -f "$OUT_FILE.tmp" "$OUT_FILE"
fi

exit 0
