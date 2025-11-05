// server/init.js
import { execSync } from "node:child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prismaSchema = path.resolve(__dirname, "../prisma/schema.prisma");
const migrationsDir = path.resolve(__dirname, "../prisma/migrations");

function run(cmd, label = "") {
  console.log(`🔧 ${label || cmd}`);
  try {
    const result = execSync(cmd, { stdio: "pipe", env: process.env });
    console.log(result.toString());
    console.log(`✅ ${label || cmd} — OK`);
    return result.toString();
  } catch (err) {
    // combine both stdout and stderr to detect Prisma error codes
    const output =
      (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
    console.error(`❌ ${label || cmd} — FAILED`);
    console.error(output);
    return { failed: true, output };
  }
}

function getFirstMigrationName() {
  if (!fs.existsSync(migrationsDir)) return null;
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs[0] || null;
}

async function main() {
  console.log("🚀 Prisma bootstrap starting…");

  // 1️⃣ Generate Prisma client
  const gen = run(
    `npx prisma generate --schema="${prismaSchema}"`,
    "Generate Prisma Client",
  );
  if (gen.failed) {
    console.error("💥 Prisma generate failed. Exiting.");
    process.exit(1);
  }

  // 2️⃣ Try migrations
  const deploy = run(
    `npx prisma migrate deploy --schema="${prismaSchema}"`,
    "Deploy Migrations",
  );

  if (deploy.failed && deploy.output.includes("P3005")) {
    console.warn("⚠️ P3005 detected — running baseline resolve...");
    const first = getFirstMigrationName();
    if (first) {
      run(
        `npx prisma migrate resolve --applied "${first}" --schema="${prismaSchema}"`,
        `Baseline "${first}"`,
      );
      const retry = run(
        `npx prisma migrate deploy --schema="${prismaSchema}"`,
        "Retry Deploy After Baseline",
      );
      if (retry.failed) {
        console.error("❌ Migration retry failed after baseline.");
        process.exit(1);
      }
    } else {
      console.error("❌ No migrations found for baseline. Exiting.");
      process.exit(1);
    }
  } else if (deploy.failed) {
    console.error("💥 Prisma migrate deploy failed with other error.");
    process.exit(1);
  }

  console.log("✅ Prisma ready. Launching Express…");
  await import("./index.js");
}

main().catch((e) => {
  console.error("💥 Prisma init failed. Exiting.");
  console.error(e);
  process.exit(1);
});
