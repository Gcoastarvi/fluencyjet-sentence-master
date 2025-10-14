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

console.log("🚀 Starting server in", isDev ? "DEVELOPMENT" : "PRODUCTION", "mode");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API routes placeholder
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);

async function startServer() {
  try {
    if (isDev) {
      console.log("📦 Setting up Vite dev server...");
      // Development: Use Vite dev server
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server: httpServer },
        },
        appType: "spa",
      });

      console.log("✅ Vite dev server created");
      app.use(vite.middlewares);
      
      app.use("*", async (req, res, next) => {
        const url = req.originalUrl;
        console.log("📄 Serving:", url);
        try {
          const clientPath = path.resolve(process.cwd(), "client", "index.html");
          let template = fs.readFileSync(clientPath, "utf-8");
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          console.error("❌ Error serving HTML:", e);
          vite.ssrFixStacktrace(e);
          next(e);
        }
      });
    } else {
      // Production: Serve built files
      const distPath = path.resolve(__dirname, "..", "dist", "public");
      app.use(express.static(distPath));
      app.use("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }

    const PORT = 5000;
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Visit: https://954f1dba-e950-4b4b-a095-d2b2f79c270f-00-12hckg5pg3qc6.spock.replit.dev`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
