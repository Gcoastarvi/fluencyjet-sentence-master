// server/index.js
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

const NODE_ENV = process.env.NODE_ENV || "production";
const isDev = NODE_ENV === "development";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", mode: isDev ? "development" : "production" });
});

async function start() {
  if (isDev) {
    // Try to enable Vite dev middleware only when vite is actually importable.
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: { port: PORT } },
        root: path.resolve(process.cwd(), "client"),
        appType: "spa",
      });

      console.log("🔧 Vite dev middleware enabled (development mode).");
      app.use(vite.middlewares);

      // catch-all that transforms index.html via Vite
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

      // end dev handling
    } catch (err) {
      // If vite can't be imported, fall back to static serving.
      console.warn(
        "⚠️  Vite not available in this environment — falling back to static serve. (If you expect Vite dev middleware, install `vite` in the environment.)",
      );
      serveStaticFallback();
    }
  } else {
    // production (or when vite isn't available)
    serveStaticFallback();
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT} (env=${NODE_ENV})`);
  });
}

function serveStaticFallback() {
  const distPath = path.resolve(process.cwd(), "client", "dist");
  if (fs.existsSync(distPath)) {
    console.log(`📦 Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.warn(
      "⚠️  No built client found at client/dist. If you want the dev client, start Vite separately (npm --prefix client run dev) or build the client (npm --prefix client run build).",
    );
    app.get("*", (_req, res) =>
      res
        .status(404)
        .send("Client not built and Vite not available in this environment."),
    );
  }
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
