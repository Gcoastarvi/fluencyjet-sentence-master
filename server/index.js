import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 5000;

console.log(
  "🚀 Starting server in",
  isDev ? "DEVELOPMENT" : "PRODUCTION",
  "mode",
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: isDev ? "development" : "production" });
});

const httpServer = createServer(app);

async function startServer() {
  try {
    if (isDev) {
      // ---------------------------
      // 🧩 DEVELOPMENT MODE (Replit)
      // ---------------------------
      console.log("📦 Setting up Vite dev server...");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { server: httpServer } },
        root: path.resolve(process.cwd(), "client"),
        appType: "spa",
      });
      console.log("✅ Vite dev server created");

      app.use(vite.middlewares);

      app.use("*", async (req, res, next) => {
        try {
          const url = req.originalUrl;
          const indexPath = path.resolve(process.cwd(), "client", "index.html");
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
    } else {
      // ------------------------
      // 🚀 PRODUCTION MODE (Railway)
      // ------------------------
      const distPath = path.resolve(__dirname, "../client/dist");
      app.use(express.static(distPath));

      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    // ✅ Listen on the correct port (Railway provides PORT automatically)
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      if (isDev) {
        console.log("🌐 Local Dev URL: http://localhost:" + PORT);
      } else {
        console.log("🌐 Production URL will be auto-assigned by Railway");
      }
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
