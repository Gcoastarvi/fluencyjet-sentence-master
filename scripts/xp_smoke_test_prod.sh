#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-https://fluencyjet-sentence-master-production.up.railway.app/api}"
EMAIL="${EMAIL:?Set EMAIL env var}"
PASSWORD="${PASSWORD:?Set PASSWORD env var}"

LESSON_ID="${LESSON_ID:-1}"
QUESTION_ID="${QUESTION_ID:-1}"
PRACTICE_TYPE="${PRACTICE_TYPE:-reorder}"

uuid() { python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
}

echo "🔐 Login..."
LOGIN_JSON=$(python3 - <<PY
import json
print(json.dumps({"email":"$EMAIL","password":"$PASSWORD"}))
PY
)

LOGIN_RES=$(curl -sS -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data "$LOGIN_JSON")

TOKEN=$(python3 - <<'PY'
import json,sys
data=json.loads(sys.stdin.read() or "{}")
print(data.get("token",""))
PY <<< "$LOGIN_RES")

if [[ -z "$TOKEN" ]]; then
  echo "❌ Could not extract token from login response:"
  echo "$LOGIN_RES"
  exit 1
fi
echo "✅ Got token"

post_update () {
  local attemptId="$1"
  local isCorrect="$2"
  local payload
  payload=$(python3 - <<PY
import json
print(json.dumps({
  "attemptId":"$attemptId",
  "attemptNo":1,
  "completedQuiz":False,
  "isCorrect": ($isCorrect),
  "lessonId": int($LESSON_ID),
  "questionId": int($QUESTION_ID),
  "practiceType":"$PRACTICE_TYPE"
}))
PY
)
  curl -sS -X POST "$API_BASE/progress/update" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data "$payload"
}

get_field () {
  # usage: get_field '<json>' '<key>'
  python3 - "$2" <<'PY'
import json,sys
key=sys.argv[1]
data=json.loads(sys.stdin.read() or "{}")
print(data.get(key,""))
PY
}

echo ""
echo "TEST 1: correct answer awards XP (>0)"
A1="$(uuid)"
R1="$(post_update "$A1" "True")"
OK1="$(printf "%s" "$R1" | get_field ok)"
XP1="$(printf "%s" "$R1" | get_field xpAwarded)"
echo "Response: $R1"
[[ "$OK1" == "true" || "$OK1" == "True" ]] || { echo "❌ ok not true"; exit 1; }
[[ "$XP1" =~ ^[0-9]+$ && "$XP1" -gt 0 ]] || { echo "❌ xpAwarded not > 0"; exit 1; }
echo "✅ PASS xpAwarded=$XP1"

echo ""
echo "TEST 2: replay same attemptId awards 0 XP"
R2="$(post_update "$A1" "True")"
OK2="$(printf "%s" "$R2" | get_field ok)"
XP2="$(printf "%s" "$R2" | get_field xpAwarded)"
echo "Response: $R2"
[[ "$OK2" == "true" || "$OK2" == "True" ]] || { echo "❌ ok not true"; exit 1; }
[[ "$XP2" =~ ^[0-9]+$ && "$XP2" -eq 0 ]] || { echo "❌ replay xpAwarded not 0"; exit 1; }
echo "✅ PASS replay xpAwarded=$XP2"

echo ""
echo "TEST 3: wrong answer awards 0 XP"
A3="$(uuid)"
R3="$(post_update "$A3" "False")"
OK3="$(printf "%s" "$R3" | get_field ok)"
XP3="$(printf "%s" "$R3" | get_field xpAwarded)"
echo "Response: $R3"
[[ "$OK3" == "true" || "$OK3" == "True" ]] || { echo "❌ ok not true"; exit 1; }
[[ "$XP3" =~ ^[0-9]+$ && "$XP3" -eq 0 ]] || { echo "❌ wrong xpAwarded not 0"; exit 1; }
echo "✅ PASS wrong xpAwarded=$XP3"

echo ""
echo "🎉 ALL XP SMOKE TESTS PASSED"
