// client/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const replitHost =
  process.env.REPL_SLUG && process.env.REPL_ID
    ? `${process.env.REPL_SLUG}-${process.env.REPL_ID}.spock.replit.dev`
    : undefined;

export default defineConfig({
  plugins: [react()],
  // Use root base for Railway/browser. (CLI --base=/ also works, but this keeps it consistent.)
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      "localhost",
      ".repl.co",
      ".replit.dev",
      ".spock.replit.dev",
      replitHost,
      ".railway.app",
    ].filter(Boolean),
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true, // ✅ enables source maps for production build
  },
});
