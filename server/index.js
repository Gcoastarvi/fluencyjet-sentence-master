import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const isDev = process.env.NODE_ENV !== "production";

console.log(
  `🚀 Server starting in ${isDev ? "DEVELOPMENT" : "PRODUCTION"} mode`,
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve React static files in production
if (!isDev) {
  const clientDistPath = path.resolve(__dirname, "../client/dist");
  console.log("📁 Serving static files from:", clientDistPath);
  app.use(express.static(clientDistPath));

  // Catch-all: serve index.html for React Router
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Running in development mode.");
  });
}

// ✅ Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
