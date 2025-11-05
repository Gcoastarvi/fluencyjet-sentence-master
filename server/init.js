// server/init.js
import { execSync } from "node:child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prismaSchema = path.resolve(__dirname, "../prisma/schema.prisma");
const migrationsDir = path.resolve(__dirname, "../prisma/migrations");

function run(cmd, label) {
  console.log(`🔧 ${label ?? cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
    console.log(`✅ ${label ?? cmd} — OK`);
  } catch (err) {
    // Preserve the real stdout/stderr that Prisma prints above.
    console.error(`❌ ${label ?? cmd} — FAILED`);
    throw err;
  }
}

function getFirstMigrationName() {
  if (!fs.existsSync(migrationsDir)) return null;
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    // migration folders start with a timestamp-like prefix; sort lexicographically
    .map((d) => d.name)
    .sort();
  return dirs[0] ?? null;
}

async function main() {
  console.log("🚀 Prisma bootstrap starting…");

  // 1) Generate client
  run(
    `npx prisma generate --schema="${prismaSchema}"`,
    "Generate Prisma Client",
  );

  // 2) Try to deploy migrations
  try {
    run(
      `npx prisma migrate deploy --schema="${prismaSchema}"`,
      "Deploy Migrations",
    );
  } catch (err) {
    const msg = String(err?.message ?? "");
    // Auto-baseline only for P3005 (DB not empty, no _prisma_migrations)
    if (msg.includes("P3005")) {
      const first = getFirstMigrationName();
      if (!first) {
        throw new Error(
          "No migrations found in prisma/migrations — cannot baseline.",
        );
      }
      console.warn(
        `⚠️  P3005 detected. Marking "${first}" as applied (baseline) and retrying deploy…`,
      );
      run(
        `npx prisma migrate resolve --applied "${first}" --schema="${prismaSchema}"`,
        `Baseline "${first}"`,
      );
      // Retry deploy once
      run(
        `npx prisma migrate deploy --schema="${prismaSchema}"`,
        "Deploy Migrations (after baseline)",
      );
    } else {
      throw err; // some other Prisma error; fail fast
    }
  }

  console.log("✅ Prisma ready. Launching Express…");
  await import("./index.js");
}

main().catch((e) => {
  console.error("💥 Prisma init failed. Exiting.");
  console.error(e);
  process.exit(1);
});
