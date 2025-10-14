// server/index.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import open from "open"; // ✅ Auto-open live URL

// ---------- Setup ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(bodyParser.json());

// ---------- API Routes ----------
app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const user = await prisma.user.create({ data: { email, password, name } });
    res.json(user);
  } catch (e) {
    console.error("❌ Signup failed:", e.message);
    res.status(400).json({ error: "Signup failed" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password)
      return res.status(401).json({ error: "Invalid credentials" });
    res.json(user);
  } catch (e) {
    console.error("❌ Login failed:", e.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/lessons", async (_req, res) => {
  try {
    const lessons = await prisma.lesson.findMany();
    res.json(lessons);
  } catch (e) {
    console.error("❌ Lessons fetch failed:", e.message);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

app.post("/api/admin/toggle-access", async (req, res) => {
  const { email, hasAccess } = req.body;
  try {
    const updated = await prisma.user.update({
      where: { email },
      data: { hasAccess },
    });
    res.json(updated);
  } catch (e) {
    console.error("❌ Toggle access failed:", e.message);
    res.status(400).json({ error: "User not found" });
  }
});

// ---------- Serve Frontend ----------
const distPath = path.resolve(__dirname, "..", "client", "dist");
app.use(express.static(distPath));

// SPA fallback: serve index.html for non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ---------- Smart URL Detection + Auto-Open ----------
const HOST = "0.0.0.0";
const BASE_PORT = 5000;

// ✅ Updated version — detects correct Replit domain
function getReplitURL(port) {
  const internal = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_URL;
  const slug = process.env.REPL_SLUG;
  const owner = process.env.REPL_OWNER;

  // Prefer actual active Replit domain (.replit.dev or spock.replit.dev)
  if (internal) {
    if (!internal.startsWith("http")) return `https://${internal}`;
    return internal;
  }

  // Fallback for older repls
  if (slug && owner) {
    return `https://${slug}.${owner}.repl.co`;
  }

  // Local fallback
  return `http://localhost:${port}`;
}

// ---------- Start Server with Auto Port Fallback ----------
const startServer = async (port = BASE_PORT) => {
  try {
    const server = app.listen(port, HOST, async () => {
      const url = getReplitURL(port);
      console.log(`✅ Server running on: ${url}`);

      // Auto-open browser
      try {
        await open(url);
      } catch {
        console.warn("⚠️ Unable to auto-open browser tab.");
      }
    });

    // Graceful recovery from “port in use”
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`⚠️ Port ${port} in use — retrying with ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error("❌ Server error:", err);
      }
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
  }
};

startServer();
