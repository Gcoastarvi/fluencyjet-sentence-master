import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replitHost =
  process.env.REPL_SLUG && process.env.REPL_ID
    ? `${process.env.REPL_SLUG}-${process.env.REPL_ID}.spock.replit.dev`
    : undefined;

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      "localhost",
      ".repl.co",
      ".replit.dev",
      "spock.replit.dev",
      replitHost
    ].filter(Boolean)
  },
  build: {
    outDir: "dist"
  }
});

