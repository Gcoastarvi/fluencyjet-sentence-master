import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";

const app = express();

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------
// HEALTH CHECK
// ----------------------------------
app.get("/api/health", (req, res) => {
  return res.json({ ok: true, message: "API is healthy" });
});

// ----------------------------------
// CORS
// ----------------------------------
const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://fluencyjet-sentence-master-production.up.railway.app",
  "https://fluencyjet-sentence-master-production-de09.up.railway.app",
  ...(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true);

      console.warn("CORS blocked:", origin);
      return cb(new Error("CORS not allowed"));
    },
    credentials: true,
  }),
);

// ----------------------------------
// CORE MIDDLEWARE
// ----------------------------------
app.use(express.json());
app.use(cookieParser());

// ----------------------------------
// API ROUTES
// ----------------------------------
app.use("/api/auth", authRoutes);

// ----------------------------------
// STATIC FRONTEND (Vite build)
// ----------------------------------
const clientDistPath = path.join(__dirname, "../client/dist");

app.use(express.static(clientDistPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// ----------------------------------
// START SERVER
// ----------------------------------
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
