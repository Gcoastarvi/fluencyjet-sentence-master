#!/bin/bash
# 🚀 FluencyJet MVP Launch Orchestrator (Final Precision Edition)
DB="postgresql://postgres:ufdABdQzyAkvOMhiLPjeNsWLBgvoYTeb@yamanote.proxy.rlwy.net:54096/railway?sslmode=require"

echo "🔓 Unlocking Access..."
psql "$DB" -c "UPDATE \"User\" SET has_access = true WHERE email = 'mango@gmail.com';"

echo "🌱 Bulk Seeding Exercises (IDs 74-194)..."
for i in {74..194}
do
   # 🎯 Precision: quoted \"lessonId\"
   psql "$DB" -c "INSERT INTO \"PracticeExercise\" (\"lessonId\", type, content, solution) VALUES ($i, 'reorder', '[\"Hello\", \"world\"]', 'Hello world') ON CONFLICT DO NOTHING;"
done

echo "🎥 Seeding Placeholder Videos..."
# 🎯 Precision: quoted \"videoUrl\"
psql "$DB" -c "UPDATE \"Lesson\" SET \"videoUrl\" = 'https://www.youtube.com/embed/dQw4w9WgXcQ' WHERE \"videoUrl\" IS NULL;"

echo "✅ ALL BLOCKS REMOVED. Logout and Login again to verify."