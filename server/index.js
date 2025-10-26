// server/index.js
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import leaderboardRoutes from "./routes/leaderboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;

// ──────────────────────────────────────────────────────────────────────────────
// Global middleware
// ──────────────────────────────────────────────────────────────────────────────
app.disable("x-powered-by");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check (keep this very early)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: isDev ? "development" : "production" });
});

// ──────────────────────────────────────────────────────────────────────────────
// API ROUTES (MUST come BEFORE any static/SPA middleware)
// ──────────────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

// Optional: unknown API route 404 (so we never return index.html for /api/*)
app.all("/api/*", (_req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Central error handler (ensures API errors return JSON, not HTML)
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server Error" });
});

// ──────────────────────────────────────────────────────────────────────────────
async function start() {
  if (isDev) {
    // Vite dev middleware (SPA) — AFTER API routes
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { server: httpServer } },
        root: path.resolve(process.cwd(), "client"),
        appType: "spa",
      });

      // Attach Vite middlewares
      app.use(vite.middlewares);

      // SPA fallback only for NON-API paths
      app.get(/^\/(?!api).*/, async (req, res, next) => {
        try {
          const url = req.originalUrl;
          const indexPath = path.resolve(process.cwd(), "client", "index.html");
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace?.(e);
          next(e);
        }
      });
    } catch (e) {
      console.warn(
        "⚠️ Vite not installed. Falling back to static serving.",
        e?.message || "",
      );
      const distPath = path.resolve(process.cwd(), "client", "dist");
      app.use(express.static(distPath));
      app.get(/^\/(?!api).*/, (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  } else {
    // Production static serving — AFTER API routes
    const distPath = path.resolve(process.cwd(), "client", "dist");
    app.use(express.static(distPath));

    // SPA fallback only for NON-API paths
    app.get(/^\/(?!api).*/, (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  console.log(
    `🚀 New Deployment: ${new Date().toISOString()} | Mode: ${process.env.NODE_ENV}`,
  );
  console.log("✅ APIs ready: /api/auth + /api/progress + /api/leaderboard");

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Server running on port ${PORT}`);
  });
}

start();
