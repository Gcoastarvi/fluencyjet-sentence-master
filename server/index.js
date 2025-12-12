import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

// Routes
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = process.env.PORT || 8080;

// --------------------
// Middleware
// --------------------
app.use(express.json());
app.use(cookieParser());

// ✅ CORS — THIS FIXES "Failed to fetch"
app.use(
  cors({
    origin: "https://fluencyjet-sentence-master-production-de09.up.railway.app",
    credentials: true,
  }),
);

// --------------------
// API routes ONLY
// --------------------
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

// --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
