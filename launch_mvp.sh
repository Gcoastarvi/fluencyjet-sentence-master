#!/bin/bash
# 🚀 FluencyJet MVP Launch Orchestrator (SnakeCase Edition)
DB="postgresql://postgres:ufdABdQzyAkvOMhiLPjeNsWLBgvoYTeb@yamanote.proxy.rlwy.net:54096/railway?sslmode=require"

echo "🔓 Step 1: Unlocking 120 Lessons..."
psql "$DB" -c "UPDATE \"UserProfile\" SET has_access = true WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'mango@gmail.com');"

echo "🌱 Step 2: Seeding Exercises for all 120 lessons..."
for i in {74..194}
do
   psql "$DB" -c "INSERT INTO \"PracticeExercise\" (lesson_id, type, content, solution) VALUES ($i, 'reorder', '[\"Hello\", \"world\"]', 'Hello world') ON CONFLICT DO NOTHING;"
done

echo "🎥 Step 3: Seeding Placeholder Videos..."
psql "$DB" -c "UPDATE \"Lesson\" SET video_url = 'https://www.youtube.com/embed/dQw4w9WgXcQ' WHERE video_url IS NULL;"

echo "✅ MVP Launched! Refresh /b/lessons to see the results."