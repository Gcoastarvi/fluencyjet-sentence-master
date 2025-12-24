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

import { authMiddleware } from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --------------------------------------------------
// Core middleware
// --------------------------------------------------
app.use(express.json());
app.use(cookieParser());
// Public routes
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// 🔐 Apply auth middleware AFTER auth routes
app.use(authMiddleware);

// Protected routes
app.use("/api/billing", billingRouter);
app.use("/api/diagnostic", diagnosticRoutes);

const replitAllowlist = [
  // Replit preview + prod
  /\.replit\.dev$/,
  /\.repl\.co$/,
];

const railwayAllowlist = [
  "https://fluencyjet-sentence-master-production-de09.up.railway.app",
];

function isOriginAllowed(origin) {
  if (!origin) return true; // allow curl / server-to-server

  if (localhostAllowlist.includes(origin)) return true;
  if (railwayAllowlist.includes(origin)) return true;

  return replitAllowlist.some((regex) => regex.test(origin));
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS blocked: " + origin));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// IMPORTANT: handle preflight
app.options("*", cors());

// --------------------------------------------------
// CORS (dev-safe + Railway-safe + Replit-safe)
// --------------------------------------------------
//
// Set in Railway (optional):
// CORS_ORIGINS=https://your-frontend.com,https://another-domain.com
//
// If NOT set → allow localhost + *.replit.dev + *.repl.co
//
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const localhostAllowlist = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
];

function isReplitOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".replit.dev") || hostname.endsWith(".repl.co");
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  // Allow non-browser tools (curl, Postman, Railway health checks)
  if (!origin) return true;

  // If strict allowlist is set → enforce it
  if (envOrigins.length > 0) {
    return envOrigins.includes(origin);
  }

  // Dev mode allowlist
  if (localhostAllowlist.includes(origin)) return true;
  if (isReplitOrigin(origin)) return true;

  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) {
        return cb(null, true);
      }
      return cb(null, false); // IMPORTANT: do not throw
    },
    credentials: true,
  }),
);

// --------------------------------------------------
// API routes ONLY
// --------------------------------------------------
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api/diagnostic", diagnosticRoutes);

// --------------------------------------------------
// Optional static client serving (Replit preview / monolith)
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "../client/dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback (supports /diagnostic refresh)
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// --------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);

  if (envOrigins.length > 0) {
    console.log("✅ CORS strict allowlist enabled:", envOrigins);
  } else {
    console.log(
      "✅ CORS dev allowlist enabled (localhost + *.replit.dev + *.repl.co)",
    );
  }
});
