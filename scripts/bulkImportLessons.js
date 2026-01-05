// scripts/bulkImportLessons.js
const fs = require("fs");
const path = require("path");

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const LESSON_DIR = path.join(__dirname, "lessons");

// expects filenames like lesson-001.txt
function lessonIdFromFilename(name) {
  const m = name.match(/^lesson-(\d+)\.txt$/);
  if (!m) return null;
  return Number(m[1]); // 001 -> 1
}

async function postTxt({
  lessonId,
  text,
  mode = "reorder",
  difficulty = "beginner",
}) {
  const url = `${API_BASE}/api/quizzes/import/txt?lessonId=${lessonId}&mode=${mode}&difficulty=${difficulty}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: text,
  });

  const body = await res.text();
  if (!res.ok)
    throw new Error(`Import failed lesson ${lessonId}: ${res.status}\n${body}`);
  return body;
}

async function main() {
  const files = fs
    .readdirSync(LESSON_DIR)
    .filter((f) => /^lesson-\d+\.txt$/.test(f))
    .sort();

  if (!files.length) {
    console.log("No lesson files found in", LESSON_DIR);
    process.exit(0);
  }

  console.log("Importing lessons from:", LESSON_DIR);
  for (const f of files) {
    const lessonId = lessonIdFromFilename(f);
    const full = path.join(LESSON_DIR, f);
    const text = fs.readFileSync(full, "utf8");

    process.stdout.write(`→ ${f} (lessonId=${lessonId}) ... `);
    await postTxt({ lessonId, text });
    console.log("OK");
  }

  console.log("✅ Bulk import complete.");
}

main().catch((e) => {
  console.error("❌ Bulk import error:", e.message);
  process.exit(1);
});
