#!/usr/bin/env bash
set -euo pipefail

BASE="https://fluencyjet-sentence-master-production.up.railway.app"

EMAIL="${EMAIL:-mango@gmail.com}"
PASS="${PASS:-admin123}"

echo "== Login"
LOGIN=$(curl -s -H "Content-Type: application/json" -X POST \
  "$BASE/api/auth/login" \
  --data "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")

echo "$LOGIN" | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8")); if(!j.token) {console.error(j); process.exit(1);} console.log("token ok");'

TOKEN=$(echo "$LOGIN" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
echo "TOKEN length: ${#TOKEN}"

ATTEMPT="smoke-$(date +%s)"

echo "== XP update"
RESP=$(curl -s -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -X POST \
  "$BASE/api/progress/update" \
  --data "{\"attemptId\":\"$ATTEMPT\",\"attemptNo\":1,\"xp\":150,\"event\":\"typing_correct\",\"meta\":{\"lessonId\":1,\"mode\":\"typing\"}}")

echo "$RESP" | node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(0,"utf8")); if(!j.ok){console.error(j); process.exit(1);} console.log("xp ok");'

echo "== Progress me"
ME=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/progress/me")
echo "$ME" | node -e 'const fs=require("fs");JSON.parse(fs.readFileSync(0,"utf8")); console.log("progress ok");'

echo "✅ Smoke test passed"
