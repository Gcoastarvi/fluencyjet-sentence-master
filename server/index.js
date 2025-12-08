// server/index.js
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

// ROUTES
import prisma from "./db/client.js";
import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import xpRoutes from "./routes/xp.js";
import healthRoutes from "./routes/health.js";
import testRoutes from "./routes/test.js";
import dashboardRoutes from "./routes/dashboard.js";
import lessonRoutes from "./routes/lessons.js";
import adminRoutes from "./routes/admin.js";
import quizRoutes from "./routes/quizzes.js";

import adminAuthRoutes from "./routes/adminAuth.js";
import adminUsersRoutes from "./routes/adminUsers.js";
import adminDashboardRoutes from "./routes/adminDashboard.js";
import adminLessonsRoutes from "./routes/adminLessons.js";
import adminQuizzesRoutes from "./routes/adminQuizzes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = createServer(app);

// ---------------- SECURITY ----------------
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ---------------- CORS ----------------
const allowlist = new Set([
  "http://localhost:5173",
  "https://fluencyjet-sentence-master-production-de09.up.railway.app",
  "https://fluencyjet-sentence-master-production.up.railway.app",
  "https://fluencyjet-sentence-master.vercel.app",
  "https://app.fluencyjet.com",
  "https://fluencyjet.com",
  ...(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowlist.has(origin)) return cb(null, true);
      if (origin.endsWith(".up.railway.app")) return cb(null, true);
      console.warn("🚫 CORS blocked:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// ---------------- LOGGING ----------------
app.use(morgan(isDev ? "dev" : "combined"));

// ---------------- BODY PARSER ----------------
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// ---------------- RATE LIMIT ----------------
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  }),
);

// ---------- API ROUTES ----------
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/xp", xpRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/quizzes", quizRoutes);

// ADMIN ROUTES
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/lessons", adminLessonsRoutes);
app.use("/api/admin/quizzes", adminQuizzesRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin", adminRoutes);

// ❌ API 404 (must be last API route)
app.all("/api/*", (req, res) => {
  return res.status(404).json({
    ok: false,
    message: "API route not found",// redeploy trigger
  });
});

// ============================================================
// 🚀 FRONTEND STATIC SERVING (THE MISSING PART)
// ============================================================

// Absolute path to client build
const clientDist = path.join(__dirname, "../client/dist");

// Serve static files
app.use(express.static(clientDist));

// Handle all non-API routes → return React index.html
app.get("*", (req, res) => {
  const indexFile = path.join(clientDist, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  res.status(500).send("Frontend build missing");
});

// ============================================================

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Deployed ${new Date().toISOString()} | Mode: ${process.env.NODE_ENV}`,
  );
  console.log("🌐 Server running on port", PORT);
});
