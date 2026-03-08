#!/bin/bash
# 🚀 FluencyJet MVP Launch Orchestrator (CamelCase Quoted Edition)
DB="postgresql://postgres:ufdABdQzyAkvOMhiLPjeNsWLBgvoYTeb@yamanote.proxy.rlwy.net:54096/railway?sslmode=require"

echo "🔓 Unlocking 120 Lessons..."
psql "$DB" -c "UPDATE \"UserProfile\" SET \"hasAccess\" = true WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'mango@gmail.com');"

echo "🌱 Seeding Exercises (IDs 74-194)..."
for i in {74..194}
do
   psql "$DB" -c "INSERT INTO \"PracticeExercise\" (\"lessonId\", type, content, solution) VALUES ($i, 'reorder', '[\"Hello\", \"world\"]', 'Hello world') ON CONFLICT DO NOTHING;"
done

echo "🎥 Seeding Placeholder Videos..."
psql "$DB" -c "UPDATE \"Lesson\" SET \"videoUrl\" = 'https://www.youtube.com/embed/dQw4w9WgXcQ' WHERE \"videoUrl\" IS NULL;"

echo "✅ DONE. Refresh /b/lessons now."