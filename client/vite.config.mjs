import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Try to use SWC if installed, otherwise fall back to Babel plugin.
async function resolveReactPlugin() {
  try {
    const mod = await import('@vitejs/plugin-react-swc');
    return mod.default();
  } catch {
    const mod = await import('@vitejs/plugin-react');
    return mod.default();
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const replitHost =
  process.env.REPL_SLUG && process.env.REPL_ID
    ? `${process.env.REPL_SLUG}-${process.env.REPL_ID}.spock.replit.dev`
    : undefined;

const reactPlugin = await resolveReactPlugin();

export default defineConfig({
  plugins: [reactPlugin],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['localhost', '.repl.co', '.replit.dev', 'spock.replit.dev', replitHost].filter(Boolean),
  },
  build: {
    outDir: 'dist',
  },
});

