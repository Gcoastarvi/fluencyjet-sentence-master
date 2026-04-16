import express from "express";
import cookieParser from "cookie-parser";
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
import adminLessonsRouter from "./routes/adminLessons.js";
import adminLessonsUpsertRouter from "./routes/adminLessonsUpsert.js";
import meRouter from "./routes/me.js";
import shopRouter from "./routes/shop.js";
import userRoutes from "./routes/user.js";
import adminAuthRouter from "./routes/adminAuth.js";

// Auth middleware
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 8080;

// 🎯 SHIFTED CORS BLOCK STARTS HERE
import cors from "cors";

const corsOptions = {
  origin: true, // 🛡️ Temporary "God Mode" to bypass the wall
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
};

app.use(cors(corsOptions)); // 🚀 THE ENGINE IS NOW AT THE TOP

app.set("trust proxy", 1);

// ✅ Unbreakable body parsing (JSON + urlencoded)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ cookies (you already have cookie-parser dependency)
app.use(cookieParser());

app.set("etag", false);

app.use("/api/user", userRoutes);

app.use("/api/admin/auth", adminAuthRouter);

// Prevent caching for API responses (fixes 304 issues in browser)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.use(
  cors({
    origin: [
      "https://fluencyjet-sentence-master-production.up.railway.app",
      "https://fluencyjet-sentence-master-production-de09.up.railway.app", // 👈 Add the URL from your screenshot error
    ],
    credentials: true,
  }),
);

/* --------------------------------------------------
   Core middleware
-------------------------------------------------- */
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
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

const ALLOW_HEADERS =
  "Content-Type, Authorization, Cache-Control, Pragma, If-None-Match";
const ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

app.post("/api/admin/reset-leagues", async (req, res) => {
  // 🛡️ Simple security check
  if (req.headers.authorization !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return res.status(401).send("Unauthorized");
  }

  // Run the logic from our reset script
  const result = await runLeagueResetLogic();
  res.json({ success: true, result });
});

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
// --- Standard API Routes ---
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter); // Moved up for quicker auth checks
app.use("/api/billing", billingRouter);
app.use("/api/diagnostic", diagnosticRoutes);
app.use("/api/shop", shopRouter);

// --- Student Progression Routes ---
app.use("/api/quizzes", quizzesRouter);
app.use("/api/xp", xpRouter);
app.use("/api/progress", progressRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/dashboard", dashboardRouter); // Student Dashboard
app.use("/api/lessons", lessonsRouter); // Student Lessons

// --- 🎯 ADMIN COMMAND CENTER (Strict Order) ---
// 1. Auth first
app.use("/api/admin/auth", adminAuthRouter);

// 2. Static Dashboard SECOND (This fixes the 'Invalid lesson id' error!)
app.use("/api/admin/dashboard", dashboardRouter);

// 3. Specific Admin Tools THIRD
app.use("/api/admin/exercises", adminExercises);
app.use("/api/admin/lessons", adminLessonsRouter);
app.use("/api/admin/lessons/upsert", adminLessonsUpsertRouter); // Give this its own path to avoid conflicts

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

/* -------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
