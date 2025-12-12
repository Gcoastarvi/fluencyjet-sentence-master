import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
// import other routers here when needed, e.g.
// import progressRoutes from "./routes/progress.js";

const app = express();

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------ HEALTH CHECK --------------
app.get("/api/health", (req, res) => {
  return res.json({ ok: true, message: "API is healthy" });
});

// ------------ CORS ----------------------
const FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://fluencyjet-sentence-master-production-de09.up.railway.app",
  "https://fluencyjet-sentence-master-production.up.railway.app",
  ...(process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
];

app.use(
  cors({
    origin(origin, cb) {
      // Allow curl / server-to-server with no Origin
      if (!origin) return cb(null, true);

      if (FRONTEND_ORIGINS.includes(origin)) {
        return cb(null, true);
      }

      console.warn("CORS blocked origin:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// ------------ CORE MIDDLEWARE -----------
app.use(express.json());
app.use(cookieParser());

// ------------ API ROUTES ----------------
app.use("/api/auth", authRoutes);
// app.use("/api/progress", progressRoutes);

// ------------ STATIC FRONTEND -----------
// Serve the built Vite frontend from client/dist
const clientDistPath = path.join(__dirname, "../client/dist");

app.use(express.static(clientDistPath));

// For any other request, send index.html and let React Router handle it
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// ------------ EXPORT APP ----------------
export default app;
// ------------------------
// START SERVER
// ------------------------
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// Serve frontend build
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
