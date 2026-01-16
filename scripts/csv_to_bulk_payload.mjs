// scripts/csv_to_bulk_payload.mjs
// Usage: node scripts/csv_to_bulk_payload.mjs content.csv
// Output: out/bulk_<lessonSlug>_<mode>.json

import fs from "fs";
import path from "path";

(function main() {
  const inputPath = process.argv[2] || "content.csv";
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ CSV not found: ${inputPath}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "out");
  fs.mkdirSync(outDir, { recursive: true });

  // Simple CSV parser (handles quotes)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuotes = !inQuotes; continue; }

      if (!inQuotes && c === ",") { row.push(cur); cur = ""; continue; }
      if (!inQuotes && (c === "\n" || c === "\r")) {
        if (c === "\r" && next === "\n") i++;
        row.push(cur); rows.push(row);
        row = []; cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const rows = parseCSV(raw).filter(r => r.some(x => String(x || "").trim() !== ""));
  if (rows.length < 2) {
    console.error("❌ CSV has no data rows.");
    process.exit(1);
  }

  // Normalize headers so CSV is tolerant (case-insensitive, snake_case, spaces)
  const rawHeaders = rows[0].map(h => String(h || "").trim());

  const norm = (h) =>
    String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")      // remove spaces
      .replace(/[_-]/g, "");    // remove _ and -

  // Build index map with normalized keys
  const idx = {};
  for (let i = 0; i < rawHeaders.length; i++) {
    const key = norm(rawHeaders[i]);
    if (!key) continue;
    idx[key] = i;
  }

  // Alias support: allow multiple header styles
  const col = {
    lessonSlug: idx.lessonslug ?? idx.slug,
    lessonTitle: idx.lessontitle ?? idx.title,
    lessonLevel: idx.lessonlevel ?? idx.level,
    mode: idx.mode ?? idx.type,
    orderIndex: idx.orderindex ?? idx.order ?? idx.index,
    promptTa: idx.promptta ?? idx.tamil ?? idx.ta,
    answer: idx.answer ?? idx.english ?? idx.en,
    xp: idx.xp,
  };

  const required = ["lessonSlug", "lessonTitle", "lessonLevel", "mode", "orderIndex", "promptTa", "answer"];
  const missing = required.filter((k) => col[k] == null);

  if (missing.length) {
    console.error("❌ Missing CSV headers:", missing.join(", "));
    console.error("   Found headers:", rawHeaders.join(", "));
    console.error("   Tip: expected headers like lessonSlug, lessonTitle, lessonLevel, mode, orderIndex, promptTa, answer, xp(optional)");
    process.exit(1);
  }

  const validLevels = new Set(["basic", "intermediate"]);
  const validModes = new Set(["typing", "reorder"]);

  const groups = new Map(); // key: slug|mode -> { slug, title, level, mode, items[] }
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1;

    const lessonSlug = String(row[col.lessonSlug] || "").trim();
    const lessonTitle = String(row[col.lessonTitle] || "").trim();
    const lessonLevel = String(row[col.lessonLevel] || "").trim().toLowerCase();
    const mode = String(row[col.mode] || "").trim().toLowerCase();
    const orderIndex = Number(String(row[col.orderIndex] || "").trim());
    const promptTa = String(row[col.promptTa] || "").trim();
    const answer = String(row[col.answer] || "").trim();

    const xp = (col.xp != null && String(row[col.xp] || "").trim())
      ? Number(String(row[col.xp]).trim())
      : 150;

    if (!lessonSlug) { errors.push(`Row ${rowNum}: missing lessonSlug`); continue; }
    if (!lessonTitle) { errors.push(`Row ${rowNum}: missing lessonTitle`); continue; }
    if (!validLevels.has(lessonLevel)) { errors.push(`Row ${rowNum}: lessonLevel must be basic|intermediate`); continue; }
    if (!validModes.has(mode)) { errors.push(`Row ${rowNum}: mode must be typing|reorder`); continue; }
    if (!Number.isFinite(orderIndex) || orderIndex <= 0) { errors.push(`Row ${rowNum}: invalid orderIndex`); continue; }
    if (!promptTa) { errors.push(`Row ${rowNum}: missing promptTa`); continue; }
    if (!answer) { errors.push(`Row ${rowNum}: missing answer`); continue; }
    if (!Number.isFinite(xp) || xp <= 0) { errors.push(`Row ${rowNum}: invalid xp`); continue; }

    const key = `${lessonSlug}|${mode}`;
    if (!groups.has(key)) {
      groups.set(key, { lessonSlug, lessonTitle, lessonLevel, mode, items: [] });
    }
    groups.get(key).items.push({ orderIndex, promptTa, answer, xp });
  }

  if (errors.length) {
    console.error("❌ Validation failed:");
    errors.slice(0, 50).forEach(e => console.error("  -", e));
    if (errors.length > 50) console.error(`  ...and ${errors.length - 50} more`);
    process.exit(1);
  }

  let fileCount = 0;
  for (const g of groups.values()) {
    g.items.sort((a, b) => a.orderIndex - b.orderIndex);

    const payload = {
      lessonSlug: g.lessonSlug,
      lessonTitle: g.lessonTitle,
      lessonLevel: g.lessonLevel,
      mode: g.mode,
      xp: 150,
      items: g.items,
    };

    const filename = `bulk_${g.lessonSlug}_${g.mode}.json`;
    fs.writeFileSync(path.join(outDir, filename), JSON.stringify(payload, null, 2));
    fileCount++;
  }

  console.log(`✅ Wrote ${fileCount} payload file(s) into: ${outDir}`);
  console.log(`   Next: node scripts/import_bulk_all.mjs`);
})();
