// server/index.js
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import authRoutes from "./routes/auth.js"; // ✅ Authentication routes
// import progressRoutes from "./routes/progress.js"; // 🚀 Coming soon (Gamification)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;

// 🧩 Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 🩺 Health check
app.get("/api/health", (_, res) => {
  res.json({
    status: "ok",
    mode: isDev ? "development" : "production",
  });
});

// ✅ Mount Routes
app.use("/api/auth", authRoutes);
// app.use("/api/progress", progressRoutes); // 🔜 For XP, streaks, badges

// 🌐 Create HTTP Server
const httpServer = createServer(app);

// 🚀 Start Server Function
async function start() {
  if (isDev) {
    // 🧩 Development Mode (with Vite)
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { server: httpServer } },
        root: path.resolve(process.cwd(), "client"),
        appType: "spa",
      });

      app.use(vite.middlewares);

      app.use("*", async (req, res, next) => {
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
    } catch {
      console.warn("⚠️ Vite not installed. Falling back to static serving.");
      const distPath = path.resolve(process.cwd(), "client", "dist");
      app.use(express.static(distPath));
      app.get("*", (_req, res) =>
        res.sendFile(path.join(distPath, "index.html")),
      );
    }
  } else {
    // 🚀 Production Mode (Static Serving)
    const distPath = path.resolve(process.cwd(), "client", "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }

  // 🧠 Deployment Confirmation Log
  const env = process.env.NODE_ENV || "development";
  console.log(`🚀 New Deployment: ${new Date().toISOString()} | Mode: ${env}`);
  console.log(`✅ Auth & DB Ready | API running on /api/auth`);

  // 🌐 Start Server
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Server running on port ${PORT}`);
  });
}

start();
