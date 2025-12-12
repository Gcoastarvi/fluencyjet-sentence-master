import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

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
// API Routes
// ─────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// ─────────────────────────────
// Frontend (Vite build)
// ─────────────────────────────
const clientDistPath = path.join(__dirname, "..", "client", "dist");

app.use(express.static(clientDistPath));

// IMPORTANT: SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// ─────────────────────────────
// Start server
// ─────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
