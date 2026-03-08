#!/bin/bash
# 🚀 FluencyJet MVP Launch Orchestrator
DB="postgresql://postgres:ufdABdQzyAkvOMhiLPjeNsWLBgvoYTeb@yamanote.proxy.rlwy.net:54096/railway?sslmode=require"

echo "🔓 Unlocking 120 Lessons..."
psql "$DB" -c "UPDATE \"UserProfile\" SET has_access = true WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'mango@gmail.com');"

echo "🌱 Bulk Seeding Exercises (IDs 74-194)..."
for i in {74..194}
do
   psql "$DB" -c "INSERT INTO \"PracticeExercise\" (lesson_id, type, content, solution) VALUES ($i, 'reorder', '[\"Hello\", \"world\"]', 'Hello world') ON CONFLICT DO NOTHING;"
done

echo "🎥 Seeding Placeholder Videos..."
psql "$DB" -c "UPDATE \"Lesson\" SET video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ' WHERE video_url IS NULL;"

echo "✅ DONE. Hard refresh your browser now."