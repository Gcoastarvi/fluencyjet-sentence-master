import express from "express";
import cookieParser from "cookie-parser";
//import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Force-load ROOT .env (workspace/.env)
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Routes
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import billingRouter from "./routes/billing.js";
import diagnosticRoutes from "./routes/diagnostic.js";
import quizzesRouter from "./routes/quizzes.js";

import xpRouter from "./routes/xp.js";
import progressRouter from "./routes/progress.js";
import leaderboardRouter from "./routes/leaderboard.js";
import dashboardRouter from "./routes/dashboard.js";
import lessonsRouter from "./routes/lessons.js";
import adminExercises from "./routes/adminExercises.js";

// Auth middleware
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 8080;

app.set("etag", false);

// Prevent caching for API responses (fixes 304 issues in browser)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/* --------------------------------------------------
   Core middleware
-------------------------------------------------- */
app.use(express.json());
app.use(cookieParser());

/* --------------------------------------------------
   CORS (single, correct definition)
-------------------------------------------------- */
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  // allow server-to-server / curl / healthchecks
  if (!origin) return true;

  // always allow explicit env allowlist
  if (envOrigins.length > 0 && envOrigins.includes(origin)) return true;

  // local dev
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;

  // Railway apps (frontend/backend often differ)
  if (/^https:\/\/.*\.up\.railway\.app$/.test(origin)) return true;

  // Replit previews
  if (/\.replit\.dev$/.test(origin)) return true;
  if (/\.repl\.co$/.test(origin)) return true;

  return false;
}

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "If-None-Match",
  ],
  exposedHeaders: ["ETag"],
};

const ALLOW_HEADERS =
  "Content-Type, Authorization, Cache-Control, Pragma, If-None-Match";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

app.get("/api/debug/static", (_req, res) => {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  res.json({
    cwd: process.cwd(),
    distPath,
    exists: fs.existsSync(distPath),
    files: fs.existsSync(distPath) ? fs.readdirSync(distPath).slice(0, 10) : [],
  });
});

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow only known origins (your function already handles env var + localhost)
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS);
    res.setHeader("Access-Control-Expose-Headers", "ETag");
  }

  // Preflight must end here with 204
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.options("*", (req, res) => res.sendStatus(204));

/* --------------------------------------------------
   Auth middleware (AFTER cors, BEFORE routes)
-------------------------------------------------- */
app.use(authMiddleware);

/* --------------------------------------------------
   API routes
-------------------------------------------------- */
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api/diagnostic", diagnosticRoutes);

app.use("/api/quizzes", quizzesRouter);

app.use("/api/xp", xpRouter);
app.use("/api/progress", progressRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/lessons", lessonsRouter);
app.use("/api/admin/exercises", adminExercises);

// -----------------------------
// Serve React build in production
// -----------------------------
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "dist", "public");

  if (!fs.existsSync(distPath)) {
    console.warn("⚠️ dist/public not found:", distPath);
  } else {
    app.use(express.static(distPath));

    // SPA fallback (must be AFTER api routes)
    app.get("*", (req, res) => {
      // don’t hijack API routes
      if (req.path.startsWith("/api")) {
        return res.status(404).json({ ok: false, error: "Not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

/* --------------------------------------------------
   Static frontend (production build output)
   NOTE: your build script copies client build into server/dist/public
-------------------------------------------------- */
const distPath = path.resolve(process.cwd(), "dist", "public");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback (must be AFTER API routes)
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* -------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
