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

// -------------------------------------------------------------------------
// SECURITY
// -------------------------------------------------------------------------
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// -------------------------------------------------------------------------
// CORS
// -------------------------------------------------------------------------
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

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowlist.has(origin)) return cb(null, true);
    if (origin.endsWith(".up.railway.app")) return cb(null, true);
    console.warn("🚫 CORS blocked:", origin);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
});
app.use(corsMiddleware);
app.options("*", corsMiddleware);

// -------------------------------------------------------------------------
// LOGGING
// -------------------------------------------------------------------------
app.use(morgan(isDev ? "dev" : "combined"));

// -------------------------------------------------------------------------
// SAFER JSON PARSER
// -------------------------------------------------------------------------
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

app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  return express.json({ limit: "1mb" })(req, res, (err) => {
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, message: "Invalid JSON body" });
    }
    next(err);
  });
});

app.use(express.urlencoded({ extended: false }));

// -------------------------------------------------------------------------
// RATE LIMIT
// -------------------------------------------------------------------------
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// -------------------------------------------------------------------------
// STARTUP LOG
// -------------------------------------------------------------------------
const routesDir = path.join(__dirname, "routes");
console.log("📂 Checking routes directory:", routesDir);
console.log(
  "📄 Routes found:",
  fs.existsSync(routesDir) ? fs.readdirSync(routesDir) : [],
);

// -------------------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------------------
app.use("/api/health", healthRoutes);

app.get("/api/_echo", (req, res) => {
  res.json({ ok: true, method: req.method, hasBody: !!req.body });
});

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
app.use("/api/admin", adminRoutes); // overview, analytics, diagnostics, etc.

// ❌ 404 must stay LAST (do not move this!)
app.all("/api/*", (req, res) => {
  return res.status(404).json({
    ok: false,
    message: "API route not found",
  });
});

if (isDev) {
  app.get("/api/debug/jwt", (req, res) => {
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
      if (!token)
        return res.status(400).json({ ok: false, message: "Missing token" });
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fluencyjet_secret_2025",
      );
      res.json({ ok: true, decoded });
    } catch (err) {
      res
        .status(401)
        .json({ ok: false, message: "Invalid token", err: err.message });
    }
  });
}

app.use("/api/test", testRoutes);

// -------------------------------------------------------------------------
// FRONTEND (PROD)
// -------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "backend",
    message: "FluencyJet backend running",
  });
});

// -------------------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------------------
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚀 Deployed ${new Date().toISOString()} | Mode: ${process.env.NODE_ENV}`,
  );
  console.log(
    "✅ APIs ready → /api/health /api/auth /api/progress /api/leaderboard /api/xp /api/dashboard /api/lessons /api/quizzes",
  );
  console.log(`🌐 Server running on port ${PORT}`);
});

// -------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
// -------------------------------------------------------------------------
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
    console.error("Shutdown error:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
