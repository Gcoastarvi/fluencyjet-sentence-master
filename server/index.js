import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import fs from "fs";

// ROUTES
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";

// ─────────────────────────────
// Setup
// ─────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ─────────────────────────────
// Middleware
// ─────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─────────────────────────────
// API Routes (MUST come before frontend)
// ─────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// ─────────────────────────────
// Frontend (Vite build)
// ─────────────────────────────
const clientDistPath = path.join(__dirname, "..", "client", "dist");
const indexHtmlPath = path.join(clientDistPath, "index.html");

// Serve static assets IF build exists
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback (React Router)
  app.get("*", (req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  // Safety log (prevents crash loops)
  console.error("❌ Frontend build not found at:", clientDistPath);

  app.get("*", (_req, res) => {
    res.status(503).send("Frontend build missing");
  });
}

// ─────────────────────────────
// Start server
// ─────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
