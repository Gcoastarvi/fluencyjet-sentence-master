// server/scripts/deploy.js
import { execSync } from "child_process";

console.log("🚀 Running deploy:migrate for Railway...");
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
  console.log("✅ Database schema up-to-date!");
} catch (e) {
  console.error("❌ Prisma migration deploy failed:", e.message);
  process.exit(1);
}
