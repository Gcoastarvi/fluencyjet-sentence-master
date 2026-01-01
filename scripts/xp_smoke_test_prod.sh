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

TOKEN="$(printf '%s' "$LOGIN_RES" | node -e "let d={}; try{d=JSON.parse(require('fs').readFileSync(0,'utf8')||'{}')}catch{}; process.stdout.write(d.token||'')")"

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
    const attemptId = process.argv[1];
    const isCorrect = process.argv[2] === 'true';
    console.log(JSON.stringify({
      attemptId,
      attemptNo: 1,
      completedQuiz: false,
      isCorrect,
      lessonId: Number(process.env.LESSON_ID || 1),
      questionId: Number(process.env.QUESTION_ID || 1),
      practiceType: String(process.env.PRACTICE_TYPE || 'reorder'),
    }));
  " "$attemptId" "$isCorrect")"

  curl -sS -X POST "$API_BASE/progress/update" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data "$payload"
}

get_ok () {
  printf "%s" "$1" | node -e "let d={}; try{d=JSON.parse(require('fs').readFileSync(0,'utf8'))}catch{}; process.stdout.write(String(d.ok??''))"
}
get_xp () {
  printf "%s" "$1" | node -e "let d={}; try{d=JSON.parse(require('fs').readFileSync(0,'utf8'))}catch{}; process.stdout.write(String(d.xpAwarded??''))"
}

assert_ok () {
  local ok="$1"
  [[ "$ok" == "true" || "$ok" == "True" ]] || { echo "❌ Expected ok=true, got: $ok"; exit 1; }
}
assert_int () {
  local v="$1"
  [[ "$v" =~ ^[0-9]+$ ]] || { echo "❌ Expected integer, got: $v"; exit 1; }
}

echo ""
echo "TEST 1: correct answer awards XP (>0)"
A1="$(uuid)"
R1="$(post_update "$A1" true)"
OK1="$(get_ok "$R1")"
XP1="$(get_xp "$R1")"
echo "Response: $R1"
assert_ok "$OK1"
assert_int "$XP1"
[[ "$XP1" -gt 0 ]] || { echo "❌ Expected xpAwarded > 0, got: $XP1"; exit 1; }
echo "✅ PASS xpAwarded=$XP1"

echo ""
echo "TEST 2: replay same attemptId awards 0 XP"
R2="$(post_update "$A1" true)"
OK2="$(get_ok "$R2")"
XP2="$(get_xp "$R2")"
echo "Response: $R2"
assert_ok "$OK2"
assert_int "$XP2"
[[ "$XP2" -eq 0 ]] || { echo "❌ Expected replay xpAwarded == 0, got: $XP2"; exit 1; }
echo "✅ PASS replay xpAwarded=$XP2"

echo ""
echo "TEST 3: wrong answer awards 0 XP"
A3="$(uuid)"
R3="$(post_update "$A3" false)"
OK3="$(get_ok "$R3")"
XP3="$(get_xp "$R3")"
echo "Response: $R3"
assert_ok "$OK3"
assert_int "$XP3"
[[ "$XP3" -eq 0 ]] || { echo "❌ Expected wrong xpAwarded == 0, got: $XP3"; exit 1; }
echo "✅ PASS wrong xpAwarded=$XP3"

echo ""
echo "🎉 ALL XP SMOKE TESTS PASSED"
