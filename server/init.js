// server/init.js
import { execSync } from "node:child_process";
import path from "path";
import { fileURLToPath } from "url";

// Resolve schema path safely for any environment (Railway, Replit, local)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prismaSchema = path.resolve(__dirname, "../prisma/schema.prisma");

// Utility runner with nice console logs
function run(cmd, label = "") {
  try {
    console.log(`🔧 Running: ${cmd} ${label}`);
    execSync(cmd, { stdio: "inherit", env: process.env });
    console.log(`✅ Done: ${label || cmd}`);
  } catch (err) {
    console.error(`❌ Failed: ${label || cmd}`);
    console.error(err.message);
    throw err;
  }
}

async function main() {
  console.log("🚀 Starting Prisma bootstrap sequence...");

  // 1️⃣ Generate Prisma client
  run(
    `npx prisma generate --schema="${prismaSchema}"`,
    "Generate Prisma Client",
  );

  // 2️⃣ Deploy migrations (no data loss, applies safely in production)
  run(
    `npx prisma migrate deploy --schema="${prismaSchema}"`,
    "Deploy Migrations",
  );

  console.log("✅ Prisma setup complete. Launching app server...\n");

  // 3️⃣ Start main Express server after DB is ready
  await import("./index.js");
}

main().catch((err) => {
  console.error("💥 Prisma initialization failed — shutting down.");
  console.error(err);
  process.exit(1);
});
