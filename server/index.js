import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isDev = process.env.NODE_ENV === "development";
const PORT = process.env.PORT || 8080;

console.log(
  `🚀 Starting server in ${isDev ? "DEVELOPMENT" : "PRODUCTION"} mode`,
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: isDev ? "development" : "production" });
});

if (!isDev) {
  // ✅ Serve Vite build from /client/dist
  const clientDistPath = path.resolve(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  // ✅ For any React route, return index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  // 🧩 Development mode (optional local usage)
  app.get("/", (req, res) => {
    res.send("Running in development mode");
  });
}

// Start server
const server = createServer(app);
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
