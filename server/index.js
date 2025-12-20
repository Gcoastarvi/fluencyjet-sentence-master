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

const app = express();
const PORT = process.env.PORT || 8080;

// --------------------
// Middleware
// --------------------
app.use(express.json());
app.use(cookieParser());

// --------------------
// CORS (fixes "Failed to fetch" from spock.replit.dev / repl.co / localhost)
// --------------------
//
// Set CORS_ORIGINS in Railway like:
// CORS_ORIGINS=https://<your-frontend-domain>,https://<another-domain>
//
// If not set, we allow common dev origins for Replit + localhost.
const envOriginsRaw = (process.env.CORS_ORIGINS || "").trim();
const envOrigins = envOriginsRaw
  ? envOriginsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
];

function isAllowedOrigin(origin) {
  // Allow non-browser clients (curl/postman without Origin header)
  if (!origin) return true;

  // If user provided allowlist, use it
  if (envOrigins.length > 0) return envOrigins.includes(origin);

  // Otherwise: allow localhost + Replit hosted domains (replit.dev, repl.co)
  if (defaultDevOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith(".replit.dev")) return true;
    if (hostname.endsWith(".repl.co")) return true;
    return false;
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

// --------------------
// API routes ONLY
// --------------------
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api/diagnostic", diagnosticRoutes);

// --------------------
// Optional: serve client/dist when present (helpful on Replit preview)
// --------------------
// This will NOT break Railway if dist doesn't exist.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../client/dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback (so /diagnostic works on refresh)
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
  if (envOrigins.length > 0) {
    console.log(`✅ CORS allowlist (CORS_ORIGINS):`, envOrigins);
  } else {
    console.log(
      `✅ CORS default dev allowlist enabled (localhost + *.replit.dev + *.repl.co)`,
    );
  }
});
