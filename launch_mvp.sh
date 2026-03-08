#!/bin/bash
# 🚀 FluencyJet Bulk Seeder & Unlocker
DB="postgresql://postgres:ufdABdQzyAkvOMhiLPjeNsWLBgvoYTeb@yamanote.proxy.rlwy.net:54096/railway?sslmode=require"

echo "🔓 Unlocking Access..."
psql "$DB" -c "UPDATE \"User\" SET has_access = true WHERE email = 'mango@gmail.com';"

echo "🌱 Bulk Seeding Exercises for all 120 lessons..."
# This loop ensures every lesson has at least one exercise so 'Smart Start' works
for i in {74..194}
do
   psql "$DB" -c "INSERT INTO \"PracticeExercise\" (\"lessonId\", type, content, solution) VALUES ($i, 'reorder', '[\"Hello\", \"world\"]', 'Hello world') ON CONFLICT DO NOTHING;"
done

echo "🎥 Seeding Placeholder Videos..."
psql "$DB" -c "UPDATE \"Lesson\" SET \"videoUrl\" = 'https://www.youtube.com/embed/dQw4w9WgXcQ' WHERE \"videoUrl\" IS NULL;"

echo "✅ MVP IS LIVE. Refresh your browser!"