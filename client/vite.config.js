// client/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const replitHost =
  process.env.REPL_SLUG && process.env.REPL_OWNER
    ? `${process.env.REPL_SLUG}-${process.env.REPL_ID}.spock.replit.dev`
    : undefined;

export default defineConfig({
  plugins: [react()],
  base: "./",
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
      "spock.replit.dev",
      replitHost,
      ".railway.app",
    ].filter(Boolean),
    // 👇 NEW: dev proxy → forwards /api to your Node server at 8080
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
