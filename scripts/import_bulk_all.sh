#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://fluencyjet-sentence-master-production.up.railway.app}"
OUT_DIR="${OUT_DIR:-out}"

if [ ! -d "$OUT_DIR" ]; then
  echo "❌ OUT_DIR not found: $OUT_DIR"
  echo "Run: node scripts/csv_to_bulk_payload.mjs content.csv"
  exit 1
fi

echo "== Importing payloads from $OUT_DIR"
count=0

for f in "$OUT_DIR"/bulk_*.json; do
  [ -e "$f" ] || { echo "❌ No payload files found in $OUT_DIR"; exit 1; }

  echo ""
  echo "== Import: $f"
  res=$(curl -s -H "Content-Type: application/json" \
    -X POST "$BASE_URL/api/admin/exercises/bulk" \
    --data-binary @"$f")

  echo "$res"

  ok=$(echo "$res" | node -p "try{const j=JSON.parse(require('fs').readFileSync(0,'utf8')); j.ok===true}catch(e){false}")
  if [ "$ok" != "true" ]; then
    echo "❌ Import failed for: $f"
    exit 1
  fi

  count=$((count+1))
done

echo ""
echo "✅ Imported $count payload file(s) successfully."
