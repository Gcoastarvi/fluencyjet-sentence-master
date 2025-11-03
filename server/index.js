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
import { PrismaClient } from "@prisma/client";

// Routes
import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import xpRoutes from "./routes/xp.js";

/* ───────────────────────────── Basics ───────────────────────────── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;
const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

/* ───────────────────── Global middleware (order matters) ───────────────────── */
app.disable("x-powered-by");
app.set("trust proxy", 1);

// 🧠 Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// 🌍 Tightened CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "https://fluencyjet.app",
  "https://fluencyjet-sentence-master.vercel.app",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// 🧾 Logging & parsing
app.use(morgan(isDev ? "dev" : "combined"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// 🧩 URL normalization middleware
app.use((req, _res, next) => {
  req.url = req.url.trim();
  next();
});

// 🚦 Basic rate limiting (prevents brute force & spam)
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests/min
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

/* ───────────────────── Route Diagnostics (Startup Log) ───────────────────── */
const routesDir = path.resolve("./server/routes");
console.log("📂 Checking routes directory:", routesDir);
if (fs.existsSync(routesDir)) {
  console.log("📄 Routes found:", fs.readdirSync(routesDir));
} else {
  console.log("⚠️ Routes folder missing at:", routesDir);
}

/* ─────────────────────────── Health & Debug Endpoints ─────────────────────────── */

// ✅ Lightweight health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: isDev ? "development" : "production" });
});

// ✅ Deep DB check (optional for uptime monitoring)
app.get("/api/health/full", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [users, lessons, badges] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.badge.count(),
    ]);
    res.json({
      ok: true,
      db: "up",
      counts: { users, lessons, badges },
      mode: isDev ? "development" : "production",
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /api/health/full error:", err);
    res.status(500).json({ ok: false, db: "down", error: err.message });
  }
});

// 🧩 Optional JWT test — only available in development
if (isDev) {
  app.get("/api/debug/jwt", (req, res) => {
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token)
        return res
          .status(400)
          .json({ ok: false, message: "Missing Bearer token" });

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fluencyjet_secret_2025",
      );
      res.json({ ok: true, decoded });
    } catch (err) {
      res.status(401).json({
        ok: false,
        message: "Invalid or expired token",
        error: err.message,
      });
    }
  });
}

/* ──────────────────────────────── API ROUTES ──────────────────────────────── */

// Mount main APIs
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/xp", xpRoutes);

// ✅ Mount test route before 404 handler
import testRoutes from "./routes/test.js";
app.use("/api/test", testRoutes);

/* ─────────────────────────────── 404 + ERRORS ─────────────────────────────── */
app.all("/api/*", (_req, res) =>
  res.status(404).json({ ok: false, message: "API route not found" }),
);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res
    .status(err.status || 500)
    .json({ ok: false, message: err.message || "Internal Server Error" });
});

/* ────────────────────────────── SERVER STARTUP ────────────────────────────── */
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Deployed ${new Date().toISOString()} | Mode: ${process.env.NODE_ENV}`,
  );
  console.log(
    "✅ APIs ready → /api/health /api/auth /api/progress /api/leaderboard /api/xp",
  );
  console.log(`🌐 Server running on port ${PORT}`);
});

/* ────────────────────────── Graceful Shutdown ──────────────────────────────── */
async function shutdown(signal) {
  try {
    console.log(`\n${signal} received — shutting down gracefully...`);
    await prisma.$disconnect();
    httpServer.close(() => {
      console.log("✅ Server closed cleanly. Bye 👋");
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
