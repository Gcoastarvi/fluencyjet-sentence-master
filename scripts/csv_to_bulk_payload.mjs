// scripts/csv_to_bulk_payload.mjs
// Usage:
//   node scripts/csv_to_bulk_payload.mjs content.csv
//
// Output:
//   out/bulk_L<lessonId>_<mode>.json
//
// CSV required headers:
// lessonId,lessonLevel,mode,orderIndex,promptTa,answer,xp
//
// Optional headers (ignored for now):
// lessonSlug,lessonTitle

import fs from "fs";
import path from "path";

const inputPath = process.argv[2] || "content.csv";
if (!fs.existsSync(inputPath)) {
  console.error(`❌ CSV not found: ${inputPath}`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "out");
fs.mkdirSync(outDir, { recursive: true });

function normalizeHeader(h) {
  return String(h || "").trim();
}

// Simple CSV parser (handles quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    cur += c;
  }

  // last cell
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

function must(v) {
  return String(v || "").trim();
}

const raw = fs.readFileSync(inputPath, "utf8");
const parsed = parseCSV(raw).filter((r) => r.some((x) => String(x || "").trim() !== ""));
if (parsed.length < 2) {
  console.error("❌ CSV has no data rows.");
  process.exit(1);
}

const headers = parsed[0].map(normalizeHeader);
const idx = {};
headers.forEach((h, i) => (idx[h] = i));

const required = ["lessonId", "lessonLevel", "mode", "orderIndex", "promptTa", "answer"];
const missingHeaders = required.filter((h) => !(h in idx));
if (missingHeaders.length) {
  console.error("❌ Missing CSV headers:", missingHeaders.join(", "));
  console.error("   Required headers:", required.join(", "));
  process.exit(1);
}

const validLevels = new Set(["basic", "intermediate"]);
const validModes = new Set(["typing", "reorder"]);

const groups = new Map(); // key: `${lessonId}|${mode}` -> {lessonId, mode, xpDefault, items[]}
const errors = [];

for (let r = 1; r < parsed.length; r++) {
  const row = parsed[r];
  const rowNum = r + 1; // human line number (1-indexed)

  const lessonId = Number(must(row[idx.lessonId]));
  const lessonLevel = must(row[idx.lessonLevel]).toLowerCase();
  const mode = must(row[idx.mode]).toLowerCase();
  const orderIndex = Number(must(row[idx.orderIndex]));
  const promptTa = must(row[idx.promptTa]);
  const answer = must(row[idx.answer]);
  const xpRaw = "xp" in idx ? must(row[idx.xp]) : "";
  const xp = xpRaw ? Number(xpRaw) : 150;

  if (!Number.isFinite(lessonId) || lessonId <= 0) {
    errors.push(`Row ${rowNum}: invalid lessonId`);
    continue;
  }
  if (!validLevels.has(lessonLevel)) {
    errors.push(`Row ${rowNum}: lessonLevel must be basic|intermediate (got "${lessonLevel}")`);
    continue;
  }
  if (!validModes.has(mode)) {
    errors.push(`Row ${rowNum}: mode must be typing|reorder (got "${mode}")`);
    continue;
  }
  if (!Number.isFinite(orderIndex) || orderIndex <= 0) {
    errors.push(`Row ${rowNum}: invalid orderIndex`);
    continue;
  }
  if (!promptTa) {
    errors.push(`Row ${rowNum}: missing promptTa`);
    continue;
  }
  if (!answer) {
    errors.push(`Row ${rowNum}: missing answer`);
    continue;
  }
  if (!Number.isFinite(xp) || xp <= 0) {
    errors.push(`Row ${rowNum}: invalid xp`);
    continue;
  }

  const key = `${lessonId}|${mode}`;
  if (!groups.has(key)) {
    groups.set(key, {
      lessonId,
      mode,
      xpDefault: 150,
      items: [],
    });
  }

  groups.get(key).items.push({
    orderIndex,
    promptTa,
    answer,
    xp,
    level: lessonLevel, // carried through for future-proofing
  });
}

// Print errors and fail
if (errors.length) {
  console.error("❌ Validation failed:");
  for (const e of errors.slice(0, 50)) console.error("  -", e);
  if (errors.length > 50) console.error(`  ...and ${errors.length - 50} more`);
  process.exit(1);
}

// Write payload files
let fileCount = 0;
for (const g of groups.values()) {
  g.items.sort((a, b) => a.orderIndex - b.orderIndex);

  const payload = {
    lessonId: g.lessonId,
    mode: g.mode,
    xp: 150,
    items: g.items.map((it) => ({
      orderIndex: it.orderIndex,
      promptTa: it.promptTa,
      answer: it.answer,
      xp: it.xp,
      level: it.level,
    })),
  };

  const filename = `bulk_L${g.lessonId}_${g.mode}.json`;
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(payload, null, 2));
  fileCount++;
}

console.log(`✅ Wrote ${fileCount} payload file(s) into: ${outDir}`);
console.log(`   Next: bash scripts/import_bulk_all.sh`);
