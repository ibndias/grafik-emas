#!/usr/bin/env bash
# Fetch gold prices and USD->IDR rates at build time.
# Tries multiple sources for resilience; build never fails.
set -u

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
OUT_DIR="api"
mkdir -p "$OUT_DIR"

# Download URL to file. Returns 0 if HTTP 200, else 1.
download() {
  local url="$1"
  local out="$2"
  local code
  code=$(curl -sS -L -o "$out" -w "%{http_code}" \
    -A "$UA" \
    -H "Accept: text/csv,application/json,text/plain,*/*" \
    -H "Accept-Language: en-US,en;q=0.9" \
    --max-time 30 \
    --retry 3 --retry-delay 2 \
    "$url" 2>/dev/null || echo "000")
  [ "$code" = "200" ]
}

# ---------- GOLD ----------
GOLD_OUT="$OUT_DIR/gold.csv"
GOLD_SRC=""

echo "Fetching gold prices..."
TMP="$OUT_DIR/.gold.tmp"

# Try FRED daily LBMA AM Fix first (best granularity, 1968+).
if download "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GOLDAMGBD228NLBM" "$TMP" \
   && head -1 "$TMP" | grep -qi "^DATE"; then
  mv "$TMP" "$GOLD_OUT"
  GOLD_SRC="FRED:GOLDAMGBD228NLBM (daily)"
# Fallback: datahub.io monthly (1833+, GitHub raw, very reliable).
elif download "https://raw.githubusercontent.com/datasets/gold-prices/master/data/monthly.csv" "$TMP" \
     && head -1 "$TMP" | grep -qi "^Date"; then
  {
    echo "DATE,VALUE"
    awk -F',' 'NR>1 && $1 ~ /^[0-9]{4}-[0-9]{2}$/ { print $1 "-15," $2 }' "$TMP"
  } > "$GOLD_OUT"
  rm -f "$TMP"
  GOLD_SRC="datahub.io gold-prices (monthly)"
else
  rm -f "$TMP" "$GOLD_OUT"
  GOLD_SRC="FAILED"
fi
echo "  Gold source: $GOLD_SRC"
[ -f "$GOLD_OUT" ] && echo "  Rows: $(wc -l < "$GOLD_OUT")  Last: $(tail -1 "$GOLD_OUT")"

# ---------- IDR ----------
IDR_OUT="$OUT_DIR/idr.csv"
IDR_SRC=""

echo "Fetching USD->IDR rates..."
TMP="$OUT_DIR/.idr.tmp"

# Try frankfurter.app first (no key, daily, 1999+, ECB-backed).
if download "https://api.frankfurter.app/1999-01-04..?from=USD&to=IDR" "$TMP" \
   && head -c 1 "$TMP" | grep -q '{'; then
  {
    echo "DATE,VALUE"
    # Parse JSON: {"rates":{"YYYY-MM-DD":{"IDR":nnnn},...}}
    if command -v jq >/dev/null 2>&1; then
      jq -r '.rates | to_entries[] | "\(.key),\(.value.IDR)"' "$TMP" | sort
    else
      python3 -c "
import json
d = json.load(open('$TMP'))
for k in sorted(d['rates']):
    print(f\"{k},{d['rates'][k]['IDR']}\")
"
    fi
  } > "$IDR_OUT"
  rm -f "$TMP"
  IDR_SRC="frankfurter.app (daily, ECB)"
# Fallback: FRED DEXINUS.
elif download "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXINUS" "$TMP" \
     && head -1 "$TMP" | grep -qi "^DATE"; then
  mv "$TMP" "$IDR_OUT"
  IDR_SRC="FRED:DEXINUS (daily)"
else
  rm -f "$TMP" "$IDR_OUT"
  IDR_SRC="FAILED"
fi
echo "  IDR source: $IDR_SRC"
[ -f "$IDR_OUT" ] && echo "  Rows: $(wc -l < "$IDR_OUT")  Last: $(tail -1 "$IDR_OUT")"

# ---------- BUILD INFO ----------
cat > "$OUT_DIR/build-info.json" <<EOF
{
  "built_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gold_source": "$GOLD_SRC",
  "idr_source": "$IDR_SRC"
}
EOF

exit 0
