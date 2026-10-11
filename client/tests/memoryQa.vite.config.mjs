// Test-only programmatic config. Never load the normal Vite config or .env files.
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export function memoryQaViteConfig(scratch) {
  return {
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    envDir: join(scratch, "empty-env"),
    cacheDir: join(scratch, "vite-cache"),
    plugins: [react()],
    base: "/",
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      open: false,
      proxy: {},
      allowedHosts: ["127.0.0.1"],
    },
  };
}
