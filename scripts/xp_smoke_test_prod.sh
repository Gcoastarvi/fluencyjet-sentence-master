#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-https://fluencyjet-sentence-master-production.up.railway.app/api}"
EMAIL="${EMAIL:?Set EMAIL env var}"
PASSWORD="${PASSWORD:?Set PASSWORD env var}"

LESSON_ID="${LESSON_ID:-1}"
QUESTION_ID="${QUESTION_ID:-1}"
PRACTICE_TYPE="${PRACTICE_TYPE:-reorder}"

uuid() { node -e "console.log(require('crypto').randomUUID())"; }

echo "🔐 Login..."
LOGIN_RES="$(curl -sS -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data "$(node -e "console.log(JSON.stringify({email: process.env.EMAIL, password: process.env.PASSWORD}))")")"

TOKEN="$(printf '%s' "$LOGIN_RES" | node -e "
let d={}; try{d=JSON.parse(require('fs').readFileSync(0,'utf8'))}catch{}
process.stdout.write(d.token||'')
")"

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
  payload="$(node -e "
    console.log(JSON.stringify({
      attemptId: process.argv[1],
      attemptNo: 1,
      completedQuiz: false,
      isCorrect: process.argv[2]==='true',
      lessonId: 1,
      questionId: 1,
      practiceType: 'reorder'
    }));
  " "$attemptId" "$isCorrect")"

  curl -sS -X POST "$API_BASE/progress/update" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data "$payload"
}

echo ""
echo "TEST 1: correct answer awards XP"
A1="$(uuid)"
R1="$(post_update "$A1" true)"
echo "$R1" | grep -q '"xpAwarded":[1-9]' || { echo "❌ XP not awarded"; exit 1; }
echo "✅ PASS"

echo ""
echo "TEST 2: replay attempt awards 0 XP"
R2="$(post_update "$A1" true)"
echo "$R2" | grep -q '"xpAwarded":0' || { echo "❌ Replay awarded XP"; exit 1; }
echo "✅ PASS"

echo ""
echo "TEST 3: wrong answer awards 0 XP"
A3="$(uuid)"
R3="$(post_update "$A3" false)"
echo "$R3" | grep -q '"xpAwarded":0' || { echo "❌ Wrong answer awarded XP"; exit 1; }
echo "✅ PASS"

echo ""
echo "🎉 ALL XP SMOKE TESTS PASSED"
