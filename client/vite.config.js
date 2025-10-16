import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // ✅ switched to SWC version (ESM-compatible)
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
    ].filter(Boolean),
  },
  build: {
    outDir: "dist",
  },
});
