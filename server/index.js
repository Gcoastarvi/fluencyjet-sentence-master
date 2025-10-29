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
const CLIENT_ROOT = path.resolve(process.cwd(), "client");

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

/* ───────────────────── Global middleware (order matters) ───────────────────── */
app.disable("x-powered-by");
app.set("trust proxy", 1); // Required for Railway/Heroku

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: isDev ? true : process.env.CLIENT_ORIGIN || true,
    credentials: true,
  }),
);

app.use(morgan(isDev ? "dev" : "combined"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
/* ─────────────── Route Diagnostic (Temporary for Debugging) ─────────────── */
import fs from "fs";
import path from "path";

const routesDir = path.resolve("./server/routes");
console.log("📂 Checking routes directory:", routesDir);
if (fs.existsSync(routesDir)) {
  console.log("📄 Routes found:", fs.readdirSync(routesDir));
} else {
  console.log("⚠️ Routes folder missing at:", routesDir);
}
/* ────────────────────────────────────────────────────────────────────────── */

/* ─────────────────────── Health & Debug Endpoints ─────────────────────── */

// 1️⃣ Basic health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: isDev ? "development" : "production" });
});

// 2️⃣ Deep DB check + table counts
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
      mode: isDev ? "development" : "production",
      counts: { users, lessons, badges },
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /api/health/full error:", err);
    res.status(500).json({ ok: false, db: "down", error: err.message });
  }
});

// 3️⃣ NEW — Unified full system debug route (Phase 3+)
app.get("/api/debug/full", async (_req, res) => {
  try {
    const start = process.uptime();
    await prisma.$queryRaw`SELECT 1`;
    const [users, lessons, badges] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.badge.count(),
    ]);
    res.json({
      ok: true,
      environment: process.env.NODE_ENV,
      database: "connected",
      prisma_version: PrismaClient.prismaVersion?.client,
      uptime_seconds: Math.round(process.uptime()),
      counts: { users, lessons, badges },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ /api/debug/full error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4️⃣ Debug — recent users (no PII)
app.get("/api/debug/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, username: true, created_at: true },
      orderBy: { created_at: "desc" },
      take: 5,
    });
    res.json({ ok: true, users });
  } catch (e) {
    console.error("❌ /api/debug/users error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 5️⃣ Debug — JWT verification test
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

/* ───────────────────────── API Routes (Before SPA!) ───────────────────────── */
import fs from "fs";
import path from "path";

// Diagnostic route listing before mounting
const routesDir = path.resolve("./server/routes");
console.log("📂 Checking routes directory:", routesDir);
if (fs.existsSync(routesDir)) {
  console.log("📄 Routes found:", fs.readdirSync(routesDir));
} else {
  console.log("⚠️ Routes folder missing at:", routesDir);
}
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/xp", xpRoutes);
// TEMP catch-all route logger
app.all("*", (req, res) => {
  console.log("❌ Unhandled route:", req.method, req.originalUrl);
  res.status(404).json({ ok: false, message: "API route not found" });
});

// Catch unknown API routes → JSON 404
app.all("/api/*", (_req, res) =>
  res.status(404).json({ ok: false, message: "API route not found" }),
);

// Central API error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res
    .status(err.status || 500)
    .json({ ok: false, message: err.message || "Internal Server Error" });
});

/* ─────────────────────────── Start server (dev/prod) ───────────────────────── */
async function start() {
  if (isDev) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { server: httpServer } },
        root: CLIENT_ROOT,
        appType: "spa",
      });

      app.use(vite.middlewares);

      app.get(/^\/(?!api).*/, async (req, res, next) => {
        try {
          const url = req.originalUrl;
          const indexPath = path.resolve(CLIENT_ROOT, "index.html");
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace?.(e);
          next(e);
        }
      });
    } catch (e) {
      console.warn("⚠️ Vite not found; serving static fallback:", e?.message);
      const distPath = path.resolve(CLIENT_ROOT, "dist");
      app.use(express.static(distPath));
      app.get(/^\/(?!api).*/, (_req, res) =>
        res.sendFile(path.join(distPath, "index.html")),
      );
    }
  } else {
    // Production static serving
    const distPath = path.resolve(CLIENT_ROOT, "dist");
    app.use(express.static(distPath));
    app.get(/^\/(?!api).*/, (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚀 Deployed ${new Date().toISOString()} | Mode: ${process.env.NODE_ENV}`,
    );
    console.log(
      "✅ APIs: /api/auth /api/progress /api/leaderboard /api/xp /api/debug/*",
    );
    console.log(`🌐 Server running on port ${PORT}`);
  });
}

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

start();
