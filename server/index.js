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

// ── Route imports
import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import xpRoutes from "./routes/xp.js";
import healthRoutes from "./routes/health.js";
import testRoutes from "./routes/test.js";

/* ───────────────────────────── Basics ───────────────────────────── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Safely serialize BigInt in JSON responses
// @ts-ignore
if (!("toJSON" in BigInt.prototype)) {
  // eslint-disable-next-line no-extend-native
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

/* ───────────────────── Global security & proxy ───────────────────── */
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

/* ─────────────────────────────── CORS CONFIG ─────────────────────────────── */
const allowedOrigins = [
  "http://localhost:5173", // local dev
  "https://fluencyjet-sentence-master-production-de09.up.railway.app", // deployed frontend
  "https://fluencyjet-sentence-master-production.up.railway.app", // backend
  "https://fluencyjet-sentence-master.vercel.app", // optional
  "https://app.fluencyjet.com", // future custom domain
  "https://fluencyjet.com",
];

// Merge with comma-separated env list FRONTEND_ORIGINS
const extraOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const finalAllowlist = new Set([...allowedOrigins, ...extraOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman/cURL
      if (finalAllowlist.has(origin)) return callback(null, true);
      if (origin.endsWith(".up.railway.app")) return callback(null, true);
      console.warn("🚫 CORS blocked request from:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Origin",
      "Accept",
      "X-Requested-With",
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

/* ─────────────────────────────── Logging ─────────────────────────────── */
app.use(morgan(isDev ? "dev" : "combined"));
/**
 * 💡 Permanent fix for “Invalid/Unexpected end of JSON input” on GETs
 * Postman sometimes sends `Content-Type: application/json` with an empty body
 * for GET/HEAD/OPTIONS. We:
 * 1) Strip stray JSON content-type when there is no body
 * 2) Skip JSON parsing entirely for GET/HEAD/OPTIONS
 */

// 1) Strip stray JSON Content-Type for body-less safe methods
app.use((req, _res, next) => {
  const ct = req.headers["content-type"] || "";
  const safeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const noBody =
    !req.headers["content-length"] && !req.headers["transfer-encoding"];
  if (safeMethod && noBody && ct.includes("application/json")) {
    delete req.headers["content-type"];
  }
  next();
});

// 2) Safe JSON parser — ONLY for non-safe methods
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return express.json({ limit: "1mb" })(req, res, (err) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, message: "Invalid JSON body" });
    }
    next(err);
  });
});

// URL-encoded (after JSON)
app.use(express.urlencoded({ extended: false }));

// URL normalization (trims stray spaces)
app.use((req, _res, next) => {
  req.url = req.url.trim();
  next();
});

// Basic rate limiting
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
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

/* ──────────────────────────────── API ROUTES ──────────────────────────────── */

// Health first (/api/health, /api/health/db)
app.use("/api", healthRoutes);

// Small diag endpoint (optional)
app.get("/api/_echo", (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    hasBody: !!req.body,
    headers: {
      "content-type": req.headers["content-type"] || null,
      "content-length": req.headers["content-length"] || null,
    },
  });
});

// Main APIs
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/xp", xpRoutes);

// Dev-only JWT debug helper
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

// Test routes (keep before 404)
app.use("/api/test", testRoutes);

/* ─────────────────────────────── 404 + ERRORS ─────────────────────────────── */
app.all("/api/*", (_req, res) =>
  res.status(404).json({ ok: false, message: "API route not found" }),
);

// Central error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || "Internal Server Error",
  });
});

/* ─────────────────────────────── FRONTEND SERVE ───────────────────────────── */
app.use(express.static(path.join(__dirname, "..", "client", "dist")));

app.get("/typing-quiz", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"));
});

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"));
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
