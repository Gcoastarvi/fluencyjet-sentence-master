// scripts/import_bulk_all.mjs
// Usage:
//   ADMIN_EMAIL="mango@gmail.com" ADMIN_PASSWORD="admin123" node scripts/import_bulk_all.mjs
//
// Reads out/bulk_*.json (slug-based), upserts lessons, then posts to /api/admin/exercises/bulk

import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "https://fluencyjet-sentence-master-production.up.railway.app";
const OUT_DIR = process.env.OUT_DIR || "out";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const REPLACE = String(process.env.REPLACE || "").trim().toLowerCase(); // "1" or "true"
const REPLACE_QS = (REPLACE === "1" || REPLACE === "true") ? "?replace=1" : "";

if (!EMAIL || !PASSWORD) {
  console.error('❌ Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');
  process.exit(1);
}

function listPayloads() {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs.readdirSync(OUT_DIR)
    .filter(f => f.startsWith("bulk_") && f.endsWith(".json"))
    .map(f => path.join(OUT_DIR, f));
}

async function postJSON(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok || data?.ok === false) {
    throw new Error(`${url} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function login() {
  const data = await postJSON(`${BASE_URL}/api/auth/login`, null, { email: EMAIL, password: PASSWORD });
  if (!data?.token) throw new Error("Login succeeded but token missing");
  return data.token;
}

async function upsertLesson(token, { slug, title, level }) {
  const data = await postJSON(`${BASE_URL}/api/admin/lessons/upsert`, token, { slug, title, level });
  return data.lesson;
}

async function bulkImport(token, { lessonId, mode, xp, items }) {
  const replace = process.env.REPLACE === "1";
  const data = await postJSON(`${BASE_URL}/api/admin/exercises/bulk${REPLACE_QS}`, token, {
    lessonId,
    mode,
    xp,
    items,
  });
  return data;
}

(async function main() {
  const payloadFiles = listPayloads();
  if (!payloadFiles.length) {
    console.error(`❌ No payloads in ${OUT_DIR}. Run csv_to_bulk_payload first.`);
    process.exit(1);
  }

  console.log("== Login");
  const token = await login();
  console.log("token ok, len =", token.length);

  // Cache slug -> lessonId
  const lessonCache = new Map();

  let imported = 0;

  for (const file of payloadFiles) {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    const { lessonSlug, lessonTitle, lessonLevel, mode, xp, items } = payload;

    console.log("\n== Payload:", path.basename(file));
    console.log("   lessonSlug:", lessonSlug, "mode:", mode, "items:", items?.length || 0);

    // Upsert lesson
    if (!lessonCache.has(lessonSlug)) {
      const lesson = await upsertLesson(token, {
        slug: lessonSlug,
        title: lessonTitle,
        level: lessonLevel,
      });
      lessonCache.set(lessonSlug, lesson.id);
      console.log("   lesson upsert ok => id:", lesson.id);
    }

    const lessonId = lessonCache.get(lessonSlug);

    // Bulk import (id-based endpoint)
    const res = await bulkImport(token, { lessonId, mode, xp: xp || 150, items });
    console.log("   bulk ok => inserted:", res.inserted, "skipped:", res.skipped || 0);

    imported++;
  }

  console.log(`\n✅ Imported ${imported} payload(s) successfully.`);
})();
