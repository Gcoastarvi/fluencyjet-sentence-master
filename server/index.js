import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import billingRouter from "./routes/billing.js";
import diagnosticRoutes from "./routes/diagnostic.js";

// Auth middleware
import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 8080;

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

const localhostAllowlist = ["http://localhost:3000", "http://localhost:5173"];

function isAllowedOrigin(origin) {
  if (!origin) return true; // curl / Railway healthcheck

  if (envOrigins.length > 0) return envOrigins.includes(origin);

  if (localhostAllowlist.includes(origin)) return true;
  if (origin.endsWith(".up.railway.app")) return true;
  if (origin.includes(".replit.dev")) return true;
  if (origin.includes(".repl.co")) return true;

  return false;
}

app.use(
  cors({
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// IMPORTANT: preflight
app.options("*", cors());

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

/* --------------------------------------------------
   Optional static frontend (Replit / monolith)
-------------------------------------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../client/dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/* -------------------------------------------------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
