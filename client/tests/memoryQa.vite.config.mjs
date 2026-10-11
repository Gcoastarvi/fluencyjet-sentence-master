// Test-only programmatic config. Never load the normal Vite config or .env files.
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { disableQaHmrTransport } from "./memoryNavigationDiagnostics.mjs";

export function memoryQaViteConfig(scratch) {
  return {
    configFile: false,
    root: fileURLToPath(new URL("../", import.meta.url)),
    envDir: join(scratch, "empty-env"),
    cacheDir: join(scratch, "vite-cache"),
    plugins: [react(), {
      name: "offline-memory-qa-no-hmr-transport",
      enforce: "post",
      transform(code, id) {
        if (id.replaceAll("\\", "/").endsWith("/vite/dist/client/client.mjs")) {
          return { code: disableQaHmrTransport(code), map: null };
        }
      },
    }],
    base: "/",
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      open: false,
      // History/BFCache QA must not be raced by dev-client reconnect reloads.
      // Production/application Vite config is deliberately not changed.
      hmr: false,
      proxy: {},
      allowedHosts: ["127.0.0.1"],
    },
  };
}
